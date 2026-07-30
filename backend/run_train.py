"""Run the ML explainability training pipeline.

Usage:
    uv run python run_train.py
    uv run python run_train.py --sku h100_sxm_80gb --eras C D
    uv run python run_train.py --upload
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import subprocess
from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import xgboost as xgb

from basis.db.engine import async_session_factory, engine
from basis.ml.artifact import (
    SCHEMA_VERSION,
    build_artifact,
    feature_schema_hash,
    upload_artifact,
)
from basis.ml.features import (
    DEFAULT_SKU,
    ERA_LABELS,
    TRAINED_PROVIDERS,
    extract_features,
)
from basis.ml.host_effects import analyze_host_effects
from basis.ml.train import (
    InsufficientDaysError,
    LeakageDetectedError,
    TrainingResult,
    train,
)

logger = logging.getLogger(__name__)

BACKEND_ROOT = Path(__file__).resolve().parent
MODEL_OUTPUT_DIR = BACKEND_ROOT / "models"
HOLDOUT_R2_MIN = 0.2
HOLDOUT_R2_MAX = 0.85


def build_parser() -> argparse.ArgumentParser:
    """Build the command-line parser without starting analysis."""
    parser = argparse.ArgumentParser(description="Train the Basis ML explainability model.")
    parser.add_argument(
        "--sku",
        default=DEFAULT_SKU,
        help=f"canonical GPU SKU to analyze (default: {DEFAULT_SKU})",
    )
    parser.add_argument(
        "--upload",
        action="store_true",
        help="upload completed artifacts to the fixed S3 models prefix",
    )
    parser.add_argument(
        "--eras",
        nargs="+",
        choices=ERA_LABELS,
        help="optional primary-sample era filter, for example: --eras C D",
    )
    return parser


async def run_pipeline(args: argparse.Namespace) -> int:
    """Extract, train, validate, and optionally upload one artifact."""
    try:
        async with async_session_factory() as session:
            features = await extract_features(
                session,
                sku=args.sku,
                providers=TRAINED_PROVIDERS,
                eras=args.eras,
            )
            _print_extraction_summary(features)
            training = await train(
                features,
                session,
                sku=args.sku,
                trained_providers=TRAINED_PROVIDERS,
            )
        host_analysis = analyze_host_effects(features)
        _print_training_log(training, host_analysis)
    except InsufficientDaysError as exc:
        print(f"insufficient days: {exc}")
        return 0
    except LeakageDetectedError as exc:
        print(f"ABORT — {exc}")
        print("No artifact was written.")
        return 2

    stop_reasons = _director_stop_reasons(training)
    if stop_reasons:
        for reason in stop_reasons:
            print(f"STOP — {reason}")
        print("No artifact was written; Manager review is required.")
        return 2

    trained_at = datetime.now(UTC)
    date_token = trained_at.strftime("%Y%m%d")
    artifact_stem = f"explainability_v{SCHEMA_VERSION}_{date_token}"
    model_name = f"{artifact_stem}.ubj"
    json_name = f"{artifact_stem}.json"
    corpus_through = max(features["collected_day"]).isoformat()
    active_features = tuple(features.attrs["feature_columns"])
    metadata: dict[str, object] = {
        "trained_at": trained_at.isoformat().replace("+00:00", "Z"),
        "sku": args.sku,
        "trained_providers": list(TRAINED_PROVIDERS),
        "corpus_through": corpus_through,
        "corpus_rows": int(features.attrs["rows_before_dedup"]),
        "n_rows_after_dedup": len(features),
        "era_coverage": [era for era in ERA_LABELS if era in set(features["era"].astype(str))],
        "code_version": _code_version(),
        "xgboost_version": xgb.__version__,
        "fixture_hash": feature_schema_hash(active_features),
    }
    artifact = build_artifact(
        metadata=metadata,
        metrics=training.metrics,
        shap_summary=training.shap_summary,
        host_analysis=host_analysis,
        corpus_through=corpus_through,
        model_file=f"models/{model_name}",
    )

    MODEL_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    model_path = MODEL_OUTPUT_DIR / model_name
    json_path = MODEL_OUTPUT_DIR / json_name
    training.model.save_model(model_path)
    json_path.write_text(
        json.dumps(artifact, indent=2, sort_keys=True, allow_nan=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote model: {model_path}")
    print(f"Wrote artifact: {json_path}")

    if args.upload:
        model_uri = upload_artifact(model_path)
        artifact_uri = upload_artifact(json_path)
        latest_uri = upload_artifact(
            json_path,
            key="explainability_latest.json",
        )
        print(f"Uploaded model: {model_uri}")
        print(f"Uploaded artifact: {artifact_uri}")
        print(f"Updated alias: {latest_uri}")
    return 0


def _print_extraction_summary(features: Any) -> None:
    print("=== Extraction ===")
    print(f"rows_before_dedup={features.attrs.get('rows_before_dedup', 0)}")
    print(f"rows_after_dedup={len(features)}")
    print(f"distinct_days={features['collected_day'].nunique()}")
    print(f"active_features={len(features.attrs.get('feature_columns', ()))}")
    print(f"providers={features['provider'].value_counts().sort_index().to_dict()}")
    print(f"eras={features['era'].value_counts().sort_index().to_dict()}")


def _print_training_log(
    training: TrainingResult,
    host_analysis: dict[str, Any],
) -> None:
    print("=== Time-based CV folds ===")
    for fold in training.metrics["folds"]:
        print(json.dumps(fold, sort_keys=True))

    print("=== Holdout ===")
    print(json.dumps(training.metrics["holdout"], sort_keys=True))
    print(
        "r2_holdout_by_provider="
        + json.dumps(training.metrics["r2_holdout_by_provider"], sort_keys=True)
    )
    print(f"anova_explained_same_days={training.metrics['anova_explained_same_days']:.6f}")
    print(f"gap={training.metrics['gap']:.6f}")
    print("robustness_c_d=" + json.dumps(training.metrics["robustness_c_d"], sort_keys=True))

    sanity = training.sanity
    print("=== Sanity battery ===")
    print(f"permuted_target_r2={sanity['permuted_target_r2']:.6f}")
    print(f"duplicate_rows_across_split={sanity['duplicate_rows_across_split']}")
    print(f"importance_warning={sanity['importance_warning']}")
    print("top_15_gain_importances:")
    for item in sanity["top_gain_importances"]:
        print(json.dumps(item, sort_keys=True))
    print("holdout_pred_vs_actual=" + json.dumps(sanity["holdout_pred_vs_actual"], sort_keys=True))

    print("=== SHAP top 20 ===")
    print(f"n_sample={training.shap_summary['n_sample']}")
    for item in training.shap_summary["top_features"]:
        print(json.dumps(item, sort_keys=True))

    print("=== Host analysis ===")
    print(json.dumps(host_analysis, sort_keys=True))


def _director_stop_reasons(training: TrainingResult) -> list[str]:
    reasons: list[str] = []
    holdout_r2 = float(training.metrics["holdout"]["r2_oos"])
    if holdout_r2 > HOLDOUT_R2_MAX:
        reasons.append(f"holdout day-demeaned R² {holdout_r2:.6f} exceeds {HOLDOUT_R2_MAX:.2f}")
    if holdout_r2 < HOLDOUT_R2_MIN:
        reasons.append(f"holdout day-demeaned R² {holdout_r2:.6f} is below {HOLDOUT_R2_MIN:.2f}")
    if training.sanity["importance_warning"]:
        reasons.append("a single feature exceeds 50% of total gain")
    return reasons


def _code_version() -> str:
    completed = subprocess.run(
        ["git", "rev-parse", "--short", "HEAD"],
        cwd=BACKEND_ROOT.parent,
        check=True,
        capture_output=True,
        text=True,
    )
    return completed.stdout.strip()


def main(argv: Sequence[str] | None = None) -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s %(name)s: %(message)s",
    )
    args = build_parser().parse_args(argv)
    return asyncio.run(_run_and_dispose(args))


async def _run_and_dispose(args: argparse.Namespace) -> int:
    try:
        return await run_pipeline(args)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
