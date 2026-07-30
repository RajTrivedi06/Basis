"""Construction, validation, and S3 transfer helpers for ML artifacts.

The contract comes from ``docs/analysis/ml-explainability-design.md`` §7.
Unknown fields are allowed so minor schema revisions can be additive. Required
fields and their types live in one table to keep follow-up contract edits local.
"""

import hashlib
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any, TypeAlias

import boto3
from botocore.exceptions import (
    BotoCoreError,
    ClientError,
    NoCredentialsError,
    PartialCredentialsError,
)

SCHEMA_VERSION = "1.0.0"
S3_BUCKET = "basis-backups-rajt-2026"
S3_PREFIX = "models/"
S3_URI = f"s3://{S3_BUCKET}/{S3_PREFIX}"

SchemaPath: TypeAlias = tuple[str, ...]
ExpectedType: TypeAlias = type[object] | tuple[type[object], ...]
NUMBER: tuple[type[object], ...] = (int, float)

# A path ending in "[]" describes every object in the list at the parent path.
# Extra fields are intentionally accepted for additive schema evolution.
ARTIFACT_FIELDS_BY_PATH: dict[SchemaPath, dict[str, ExpectedType]] = {
    (): {
        "schema_version": str,
        "metadata": dict,
        "metrics": dict,
        "shap_summary": dict,
        "host_analysis": dict,
        "caveats": list,
        "model_file": str,
    },
    ("metadata",): {
        "trained_at": str,
        "sku": str,
        "trained_providers": list,
        "corpus_through": str,
        "corpus_rows": int,
        "n_rows_after_dedup": int,
        "era_coverage": list,
        "code_version": str,
        "xgboost_version": str,
        "fixture_hash": str,
    },
    ("metrics",): {
        "folds": list,
        "holdout": dict,
        "r2_holdout_by_provider": dict,
        "anova_explained_same_days": NUMBER,
        "gap": NUMBER,
        "permuted_target_r2": NUMBER,
        "robustness_c_d": dict,
        "sanity": dict,
    },
    ("metrics", "folds", "[]"): {
        "fold": int,
        "train_days": int,
        "test_days": int,
        "n_train": int,
        "n_test": int,
        "r2_oos": NUMBER,
        "rmse_log": NUMBER,
        "provider_mix_test": dict,
    },
    ("metrics", "holdout"): {
        "n_days": int,
        "n_test": int,
        "r2_oos": NUMBER,
        "r2_oos_pooled": NUMBER,
        "rmse_log": NUMBER,
    },
    ("metrics", "robustness_c_d"): {
        "holdout_r2_oos": NUMBER,
        "n_days": int,
    },
    ("metrics", "sanity"): {
        "duplicate_rows_across_split": int,
        "importance_warning": bool,
        "top_gain_importances": list,
        "holdout_pred_vs_actual": dict,
    },
    ("metrics", "sanity", "top_gain_importances", "[]"): {
        "feature": str,
        "gain_share": NUMBER,
    },
    ("metrics", "sanity", "holdout_pred_vs_actual"): {
        "corr": NUMBER,
        "residual_p10": NUMBER,
        "residual_p50": NUMBER,
        "residual_p90": NUMBER,
    },
    ("shap_summary",): {
        "n_sample": int,
        "top_features": list,
    },
    ("shap_summary", "top_features", "[]"): {
        "rank": int,
        "feature": str,
        "mean_abs_shap": NUMBER,
    },
    ("host_analysis",): {
        "icc": NUMBER,
        "fe_r2_increment": NUMBER,
        "n_hosts": int,
        "n_host_days": int,
        "min_days_threshold": int,
        "sensitivity": list,
        "tenure_days": dict,
    },
    ("host_analysis", "sensitivity", "[]"): {
        "threshold": int,
        "icc": NUMBER,
        "n_hosts": int,
    },
    ("host_analysis", "tenure_days"): {
        "min": int,
        "median": NUMBER,
        "max": int,
    },
}

STRING_LIST_PATHS: frozenset[SchemaPath] = frozenset(
    {
        ("metadata", "trained_providers"),
        ("metadata", "era_coverage"),
        ("caveats",),
    }
)

NUMBER_MAP_PATHS: frozenset[SchemaPath] = frozenset(
    {
        ("metrics", "r2_holdout_by_provider"),
    }
)

CAVEAT_OBSERVABLE_BOUND = "observable-features bound; says nothing about unobserved attributes"
CAVEAT_VAST_FEATURE_RICH = (
    "Vast-feature-rich: non-Vast providers described by canonical columns only"
)
CAVEAT_TRAINED_PROVIDERS = (
    "trained on vast/runpod/aws_spot/tensordock only; "
    "Azure and GCP join at first retrain with real history"
)


class ArtifactValidationError(ValueError):
    """Raised when an artifact does not satisfy the frozen JSON contract."""


class ArtifactCredentialsError(RuntimeError):
    """Raised when the default AWS credential chain provides no credentials."""


class ArtifactTransferError(RuntimeError):
    """Raised when an artifact cannot be uploaded to or downloaded from S3."""


def _display_path(path: SchemaPath) -> str:
    return ".".join(path).replace(".[]", "[]") or "<root>"


def _validate_object(value: object, path: SchemaPath) -> None:
    if not isinstance(value, dict):
        raise ArtifactValidationError(f"{_display_path(path)} must be an object")

    fields = ARTIFACT_FIELDS_BY_PATH[path]
    missing = sorted(fields.keys() - value.keys())
    if missing:
        raise ArtifactValidationError(
            f"{_display_path(path)} is missing required keys: {', '.join(missing)}"
        )

    for key, expected_type in fields.items():
        field_value = value[key]
        field_path = (*path, key)
        if isinstance(field_value, bool) and expected_type in (int, NUMBER):
            raise ArtifactValidationError(f"{_display_path(field_path)} has the wrong type")
        if not isinstance(field_value, expected_type):
            raise ArtifactValidationError(f"{_display_path(field_path)} has the wrong type")

        if field_path in ARTIFACT_FIELDS_BY_PATH:
            _validate_object(field_value, field_path)

        item_path = (*field_path, "[]")
        if item_path in ARTIFACT_FIELDS_BY_PATH:
            if not isinstance(field_value, list):
                raise ArtifactValidationError(f"{_display_path(field_path)} must be a list")
            for item in field_value:
                _validate_object(item, item_path)

        if field_path in STRING_LIST_PATHS:
            if not isinstance(field_value, list):
                raise ArtifactValidationError(f"{_display_path(field_path)} must be a list")
            if not all(isinstance(item, str) for item in field_value):
                raise ArtifactValidationError(
                    f"{_display_path(field_path)} must contain only strings"
                )

        if field_path in NUMBER_MAP_PATHS:
            if not isinstance(field_value, dict):
                raise ArtifactValidationError(f"{_display_path(field_path)} must be an object")
            if not all(
                isinstance(provider, str) and isinstance(r2, NUMBER) and not isinstance(r2, bool)
                for provider, r2 in field_value.items()
            ):
                raise ArtifactValidationError(
                    f"{_display_path(field_path)} must map provider names to numbers"
                )


def validate_artifact(d: dict[str, object]) -> None:
    """Validate an artifact in place, raising ``ArtifactValidationError`` on failure."""
    _validate_object(d, ())
    if d["schema_version"] != SCHEMA_VERSION:
        raise ArtifactValidationError(
            f"schema_version must be {SCHEMA_VERSION!r}, got {d['schema_version']!r}"
        )


def build_artifact(
    *,
    metadata: Mapping[str, object],
    metrics: Mapping[str, object],
    shap_summary: Mapping[str, object],
    host_analysis: Mapping[str, object],
    corpus_through: str,
    model_file: str,
) -> dict[str, object]:
    """Build and validate one additive schema-v1 artifact object."""
    artifact: dict[str, object] = {
        "schema_version": SCHEMA_VERSION,
        "metadata": dict(metadata),
        "metrics": dict(metrics),
        "shap_summary": dict(shap_summary),
        "host_analysis": dict(host_analysis),
        "caveats": [
            CAVEAT_OBSERVABLE_BOUND,
            CAVEAT_VAST_FEATURE_RICH,
            (f"corpus window 2026-04-26 → {corpus_through}; era B has 21 zero-Vast days"),
            CAVEAT_TRAINED_PROVIDERS,
        ],
        "model_file": model_file,
    }
    validate_artifact(artifact)
    return artifact


def feature_schema_hash(feature_columns: Sequence[str]) -> str:
    """Hash sorted active feature names for artifact reproducibility."""
    serialized = "\n".join(sorted(feature_columns)).encode("utf-8")
    return hashlib.sha256(serialized).hexdigest()


def _s3_client() -> Any:
    """Build an S3 client after resolving boto3's default credential chain."""
    try:
        session = boto3.Session()
        credentials = session.get_credentials()
        if credentials is None:
            raise ArtifactCredentialsError(
                "AWS credentials were not found in boto3's default credential chain; "
                "configure environment credentials locally or attach the EC2 IAM role"
            )
        credentials.get_frozen_credentials()
        return session.client("s3")
    except ArtifactCredentialsError:
        raise
    except (BotoCoreError, NoCredentialsError, PartialCredentialsError) as exc:
        raise ArtifactCredentialsError(
            "AWS credentials could not be loaded from boto3's default credential chain"
        ) from exc


def _artifact_key(key: str) -> str:
    normalized = key.lstrip("/")
    if not normalized.startswith(S3_PREFIX):
        normalized = f"{S3_PREFIX}{normalized}"
    if normalized == S3_PREFIX:
        raise ValueError("an artifact object name is required")
    return normalized


def upload_artifact(path: str | Path, *, key: str | None = None) -> str:
    """Upload a JSON or model artifact and return its canonical S3 URI."""
    source = Path(path)
    if not source.is_file():
        raise FileNotFoundError(f"artifact file does not exist: {source}")

    object_key = _artifact_key(key or source.name)
    try:
        _s3_client().upload_file(str(source), S3_BUCKET, object_key)
    except ArtifactCredentialsError:
        raise
    except (BotoCoreError, ClientError, NoCredentialsError, PartialCredentialsError) as exc:
        raise ArtifactTransferError(
            f"failed to upload {source} to s3://{S3_BUCKET}/{object_key}"
        ) from exc
    return f"s3://{S3_BUCKET}/{object_key}"


def download_artifact(key: str, destination: str | Path) -> Path:
    """Download a JSON or model artifact from the fixed S3 model prefix."""
    object_key = _artifact_key(key)
    target = Path(destination)
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        _s3_client().download_file(S3_BUCKET, object_key, str(target))
    except ArtifactCredentialsError:
        raise
    except (BotoCoreError, ClientError, NoCredentialsError, PartialCredentialsError) as exc:
        raise ArtifactTransferError(
            f"failed to download s3://{S3_BUCKET}/{object_key} to {target}"
        ) from exc
    return target
