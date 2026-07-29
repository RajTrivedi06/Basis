from pathlib import Path

import boto3
import pytest

from basis.ml.artifact import (
    ArtifactCredentialsError,
    ArtifactValidationError,
    upload_artifact,
    validate_artifact,
)


def minimal_artifact() -> dict[str, object]:
    return {
        "schema_version": "1.0.0",
        "metadata": {
            "trained_at": "2026-07-31T18:00:00Z",
            "sku": "h100_sxm_80gb",
            "corpus_through": "2026-07-30",
            "corpus_rows": 0,
            "n_rows_after_dedup": 0,
            "era_coverage": ["A", "B", "C", "D"],
            "code_version": "abc123",
            "xgboost_version": "3.2.0",
            "fixture_hash": "fixture-sha256",
        },
        "metrics": {
            "folds": [],
            "holdout": {
                "n_days": 10,
                "n_test": 0,
                "r2_oos": 0.0,
                "r2_oos_pooled": 0.0,
                "rmse_log": 0.0,
            },
            "anova_explained_same_days": 0.0,
            "gap": 0.0,
            "permuted_target_r2": 0.0,
            "robustness_c_d": {"holdout_r2_oos": 0.0, "n_days": 0},
        },
        "shap_summary": {"n_sample": 0, "top_features": []},
        "host_analysis": {
            "icc": 0.0,
            "fe_r2_increment": 0.0,
            "n_hosts": 0,
            "n_host_days": 0,
            "min_days_threshold": 10,
            "sensitivity": [],
            "tenure_days": {"min": 0, "median": 0, "max": 0},
        },
        "caveats": ["observable-features bound"],
        "model_file": "models/explainability_v1.0.0_20260731.ubj",
    }


def test_validate_artifact_accepts_minimal_contract() -> None:
    validate_artifact(minimal_artifact())


def test_validate_artifact_rejects_missing_metrics() -> None:
    artifact = minimal_artifact()
    del artifact["metrics"]

    with pytest.raises(ArtifactValidationError, match="metrics"):
        validate_artifact(artifact)


def test_upload_artifact_reports_missing_default_credentials(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    class SessionWithoutCredentials:
        def get_credentials(self) -> None:
            return None

    source = tmp_path / "artifact.json"
    source.write_text("{}", encoding="utf-8")
    monkeypatch.setattr(boto3, "Session", SessionWithoutCredentials)

    with pytest.raises(ArtifactCredentialsError, match="default credential chain"):
        upload_artifact(source)
