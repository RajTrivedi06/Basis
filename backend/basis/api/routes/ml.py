"""ML explainability endpoint — serves the precomputed training artifact from S3."""

from __future__ import annotations

import json
import logging
import time
from typing import Any

import boto3
from botocore.exceptions import (
    BotoCoreError,
    ClientError,
    NoCredentialsError,
    PartialCredentialsError,
)
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ml", tags=["ml"])

S3_BUCKET = "basis-backups-rajt-2026"
S3_KEY = "models/explainability_latest.json"
CACHE_TTL_SECONDS = 15 * 60

_MINIMAL_TOP_LEVEL_KEYS = (
    "schema_version",
    "metadata",
    "metrics",
    "shap_summary",
    "host_analysis",
    "caveats",
)

_cache: dict[str, Any] = {
    "artifact": None,
    "expires_at": 0.0,
}


def _clear_cache() -> None:
    """Reset the in-process artifact cache (used by tests)."""
    _cache["artifact"] = None
    _cache["expires_at"] = 0.0


def _validate_explainability_minimal(data: dict[str, Any]) -> None:
    missing = [key for key in _MINIMAL_TOP_LEVEL_KEYS if key not in data]
    if missing:
        raise ValueError(f"missing required keys: {', '.join(missing)}")


def _validate_explainability_artifact(data: dict[str, Any]) -> None:
    try:
        from basis.ml.artifact import ArtifactValidationError, validate_artifact
    except ImportError:
        _validate_explainability_minimal(data)
        return

    try:
        validate_artifact(data)
    except ArtifactValidationError as exc:
        raise ValueError(str(exc)) from exc


def _get_s3_client() -> Any:
    session = boto3.Session()
    credentials = session.get_credentials()
    if credentials is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "AWS credentials were not found in boto3's default credential chain; "
                "configure environment credentials locally or attach the EC2 IAM role"
            ),
        )
    credentials.get_frozen_credentials()
    return session.client("s3")


def _fetch_explainability_uncached() -> dict[str, Any]:
    try:
        client = _get_s3_client()
    except HTTPException:
        raise
    except (BotoCoreError, NoCredentialsError, PartialCredentialsError) as exc:
        logger.warning("explainability artifact unavailable: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="AWS credentials could not be loaded from boto3's default credential chain",
        ) from exc

    try:
        response = client.get_object(Bucket=S3_BUCKET, Key=S3_KEY)
        raw_body = response["Body"].read()
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code", "")
        if error_code in {"NoSuchKey", "404", "NotFound"}:
            logger.warning(
                "explainability artifact not found at s3://%s/%s",
                S3_BUCKET,
                S3_KEY,
            )
            raise HTTPException(
                status_code=503,
                detail=(
                    f"explainability artifact not found at s3://{S3_BUCKET}/{S3_KEY}"
                ),
            ) from exc
        logger.warning("explainability S3 request failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail=f"S3 request failed: {error_code or exc}",
        ) from exc
    except BotoCoreError as exc:
        logger.warning("explainability S3 network failure: %s", exc)
        raise HTTPException(
            status_code=503,
            detail=f"S3 network failure: {exc}",
        ) from exc

    try:
        text = raw_body.decode("utf-8")
        data = json.loads(text)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        logger.warning("explainability artifact JSON malformed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail=f"malformed explainability artifact JSON: {exc}",
        ) from exc

    if not isinstance(data, dict):
        logger.warning("explainability artifact JSON root is not an object")
        raise HTTPException(
            status_code=503,
            detail="malformed explainability artifact JSON: root must be an object",
        )

    try:
        _validate_explainability_artifact(data)
    except ValueError as exc:
        logger.warning("explainability artifact failed validation: %s", exc)
        raise HTTPException(
            status_code=503,
            detail=f"invalid explainability artifact: {exc}",
        ) from exc

    return data


def get_explainability_artifact() -> dict[str, Any]:
    """Return the cached explainability artifact, fetching from S3 when stale."""
    now = time.monotonic()
    cached = _cache["artifact"]
    if cached is not None and now < _cache["expires_at"]:
        return cached

    artifact = _fetch_explainability_uncached()
    _cache["artifact"] = artifact
    _cache["expires_at"] = now + CACHE_TTL_SECONDS
    return artifact


@router.get("/explainability")
async def get_explainability() -> dict[str, Any]:
    """Serve the frozen ML explainability artifact.

    NO live inference in v3 — precomputed results only. Production runs on a
    t3.small EC2 instance with limited memory; loading XGBoost + SHAP at request
    time would OOM or stall the API.
    """
    return get_explainability_artifact()
