import subprocess
import sys
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from basis.db.models import CanonicalOffer
from basis.ml.features import ERA_LABELS
from basis.ml.train import (
    HOLDOUT_DAY_COUNT,
    build_day_splits,
    evaluate_real_and_permuted_holdout,
    fit_training_pipeline,
    train,
)

BACKEND_ROOT = Path(__file__).resolve().parents[2]


def test_train_is_importable() -> None:
    assert callable(train)


def test_era_domain_includes_pre_cutover_backfill() -> None:
    assert ERA_LABELS == ("era_0_backfill", "A", "B", "C", "D")


def test_day_splits_keep_holdout_untouched_and_folds_ordered() -> None:
    first_day = date(2026, 4, 1)
    frame = pd.DataFrame(
        {
            "collected_day": [
                first_day + timedelta(days=offset) for offset in range(95) for _row in range(3)
            ]
        }
    )

    splits = build_day_splits(frame)

    assert len(splits.folds) == 4
    assert len(splits.holdout_days) == HOLDOUT_DAY_COUNT
    assert len(splits.pre_holdout_days) == 85
    assert [len(fold.train_days) for fold in splits.folds] == [25, 40, 55, 70]
    assert [len(fold.test_days) for fold in splits.folds] == [15, 15, 15, 15]

    holdout = set(splits.holdout_days)
    for fold in splits.folds:
        assert max(fold.train_days) < min(fold.test_days)
        assert not set(fold.train_days) & set(fold.test_days)
        assert not set(fold.train_days) & holdout
        assert not set(fold.test_days) & holdout


def test_permuted_target_collapses_on_known_signal() -> None:
    rng = np.random.default_rng(20260730)
    first_day = date(2026, 4, 1)
    records: list[dict[str, object]] = []
    for day_offset in range(35):
        for _row in range(30):
            signal = float(rng.uniform(-2.0, 2.0))
            records.append(
                {
                    "collected_day": first_day + timedelta(days=day_offset),
                    "signal": signal,
                    "y_log_price": 1.5 * signal + float(rng.normal(0.0, 0.08)),
                }
            )
    frame = pd.DataFrame.from_records(records)
    frame.attrs["feature_columns"] = ("signal",)

    real_r2, permuted_r2 = evaluate_real_and_permuted_holdout(
        frame,
        n_estimators=100,
    )

    assert real_r2 > 0.8
    assert permuted_r2 <= 0.05


def test_training_pipeline_reports_folds_holdout_sanity_and_shap() -> None:
    rng = np.random.default_rng(73)
    first_day = date(2026, 4, 1)
    records: list[dict[str, object]] = []
    for day_offset in range(30):
        for row_index in range(12):
            signal = float(rng.uniform(-2.0, 2.0))
            records.append(
                {
                    "collected_day": first_day + timedelta(days=day_offset),
                    "provider": "vast" if row_index % 2 else "aws_spot",
                    "era": "C" if day_offset < 20 else "D",
                    "signal": signal,
                    "y_log_price": signal + float(rng.normal(0.0, 0.1)),
                }
            )
    frame = pd.DataFrame.from_records(records)
    frame.attrs["feature_columns"] = ("provider", "era", "signal")

    result = fit_training_pipeline(frame, n_estimators=40)

    assert len(result.metrics["folds"]) == 4
    assert all(fold["n_train"] > 0 for fold in result.metrics["folds"])
    assert result.metrics["holdout"]["n_days"] == 10
    assert result.metrics["sanity"]["duplicate_rows_across_split"] == 0
    assert result.metrics["permuted_target_r2"] <= 0.05
    assert result.metrics["robustness_c_d"]["n_days"] == 30
    assert result.shap_summary["n_sample"] == 120
    assert result.shap_summary["top_features"]


def test_run_train_help_exits_zero() -> None:
    result = subprocess.run(
        [sys.executable, str(BACKEND_ROOT / "run_train.py"), "--help"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0
    assert "--sku" in result.stdout
    assert "--upload" in result.stdout
    assert "--eras" in result.stdout


@pytest.mark.asyncio
async def test_run_train_fixture_smoke_exits_without_traceback(
    db_session: AsyncSession,
) -> None:
    distinct_days = (
        await db_session.execute(
            select(func.count(func.distinct(func.date(CanonicalOffer.collected_at)))).where(
                CanonicalOffer.gpu_sku_canonical == "h100_sxm_80gb",
                CanonicalOffer.provider.in_(("vast", "runpod", "aws_spot", "tensordock")),
            )
        )
    ).scalar_one()
    if distinct_days >= 20:
        pytest.skip("Smoke subprocess is fixture-only; local corpus training remains gated")

    result = subprocess.run(
        [sys.executable, str(BACKEND_ROOT / "run_train.py")],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )

    combined = result.stdout + result.stderr
    assert result.returncode == 0
    assert "insufficient days" in combined
    assert "Traceback" not in combined
