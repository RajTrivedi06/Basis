"""Structural tests for GET /api/ml/explainability (no network)."""

from __future__ import annotations

import json
from pathlib import Path

import boto3
import pytest
from botocore.exceptions import ClientError
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from basis.api.main import app
from basis.api.routes import ml as ml_route

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "explainability_artifact.json"


@pytest.fixture
def explainability_fixture() -> dict[str, object]:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


@pytest.fixture(autouse=True)
def clear_ml_cache() -> None:
    ml_route._clear_cache()
    yield
    ml_route._clear_cache()


@pytest.fixture
async def ml_client() -> AsyncClient:
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client


@pytest.mark.asyncio
async def test_explainability_returns_fixture(
    ml_client: AsyncClient,
    explainability_fixture: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        ml_route,
        "_fetch_explainability_uncached",
        lambda: explainability_fixture,
    )

    response = await ml_client.get("/api/ml/explainability")
    assert response.status_code == 200, response.text
    assert response.json() == explainability_fixture


@pytest.mark.asyncio
async def test_explainability_absent_artifact_returns_503(
    ml_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def missing_artifact() -> dict[str, object]:
        raise HTTPException(
            status_code=503,
            detail=(
                "explainability artifact not found at "
                "s3://basis-backups-rajt-2026/models/explainability_latest.json"
            ),
        )

    monkeypatch.setattr(ml_route, "_fetch_explainability_uncached", missing_artifact)

    response = await ml_client.get("/api/ml/explainability")
    assert response.status_code == 503, response.text
    assert "not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_explainability_malformed_json_returns_503(
    ml_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeBody:
        def read(self) -> bytes:
            return b"not-json"

    class FakeClient:
        def get_object(self, **kwargs: object) -> dict[str, object]:
            return {"Body": FakeBody()}

    monkeypatch.setattr(ml_route, "_get_s3_client", lambda: FakeClient())

    response = await ml_client.get("/api/ml/explainability")
    assert response.status_code == 503, response.text
    assert "malformed explainability artifact JSON" in response.json()["detail"]


@pytest.mark.asyncio
async def test_explainability_no_credentials_returns_503(
    ml_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class SessionWithoutCredentials:
        def get_credentials(self) -> None:
            return None

    monkeypatch.setattr(boto3, "Session", SessionWithoutCredentials)

    response = await ml_client.get("/api/ml/explainability")
    assert response.status_code == 503, response.text
    assert "credential" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_explainability_cache_skips_second_s3_fetch(
    ml_client: AsyncClient,
    explainability_fixture: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fetch_calls = 0

    class FakeBody:
        def __init__(self, payload: dict[str, object]) -> None:
            self._payload = payload

        def read(self) -> bytes:
            return json.dumps(self._payload).encode("utf-8")

    class FakeClient:
        def get_object(self, **kwargs: object) -> dict[str, object]:
            nonlocal fetch_calls
            fetch_calls += 1
            return {"Body": FakeBody(explainability_fixture)}

    monkeypatch.setattr(ml_route, "_get_s3_client", lambda: FakeClient())

    first = await ml_client.get("/api/ml/explainability")
    second = await ml_client.get("/api/ml/explainability")

    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text
    assert fetch_calls == 1


def test_fetch_explainability_uncached_maps_s3_missing_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeClient:
        def get_object(self, **kwargs: object) -> dict[str, object]:
            raise ClientError(
                {
                    "Error": {"Code": "NoSuchKey", "Message": "missing"},
                    "ResponseMetadata": {"HTTPStatusCode": 404},
                },
                "GetObject",
            )

    monkeypatch.setattr(ml_route, "_get_s3_client", lambda: FakeClient())

    with pytest.raises(HTTPException) as exc_info:
        ml_route._fetch_explainability_uncached()

    assert exc_info.value.status_code == 503
    assert "not found" in exc_info.value.detail
