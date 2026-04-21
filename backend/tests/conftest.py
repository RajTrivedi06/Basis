"""Shared test fixtures for the Basis backend test suite."""

from collections.abc import AsyncGenerator
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.exc import InterfaceError, OperationalError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async DB session, or skip the test if the DB is unreachable.

    Uses the same connection string the app does (`settings.database_url`).
    If the DB isn't running — common in CI or on a fresh clone — the
    dependent test is skipped with a clear reason rather than failing.

    Each test gets a fresh engine with NullPool so connections are never
    shared across pytest-asyncio event loops. Without this, asyncpg's
    protocol state leaks across tests and fails with "Future attached to a
    different loop".
    """
    from basis.config import settings

    engine = create_async_engine(
        settings.database_url, echo=False, poolclass=NullPool
    )
    try:
        async with async_sessionmaker(engine, expire_on_commit=False)() as session:
            # Cheap round-trip to confirm the server accepts connections
            # before the test body runs.
            await session.execute(text("SELECT 1"))
            yield session
    except (OperationalError, InterfaceError, ConnectionRefusedError, OSError) as exc:
        pytest.skip(f"Database unreachable: {exc}")
    finally:
        await engine.dispose()


@pytest.fixture
async def api_client():
    """Yield an httpx AsyncClient wired to the FastAPI app via ASGI transport.

    Overrides the `get_db` dependency with a NullPool-backed session to avoid
    cross-event-loop connection reuse (same reason as the `db_session` fixture).
    Skips the test if the DB is unreachable.
    """
    from httpx import ASGITransport, AsyncClient

    from basis.api.deps import get_db
    from basis.api.main import app
    from basis.config import settings

    # Pre-flight: skip early if the DB is down.
    preflight_engine = create_async_engine(
        settings.database_url, echo=False, poolclass=NullPool
    )
    try:
        async with async_sessionmaker(preflight_engine, expire_on_commit=False)() as s:
            await s.execute(text("SELECT 1"))
    except (OperationalError, InterfaceError, ConnectionRefusedError, OSError) as exc:
        await preflight_engine.dispose()
        pytest.skip(f"Database unreachable: {exc}")
    await preflight_engine.dispose()

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        engine = create_async_engine(
            settings.database_url, echo=False, poolclass=NullPool
        )
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                yield session
        finally:
            await engine.dispose()

    app.dependency_overrides[get_db] = _override_get_db
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            yield client
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def sample_vast_response() -> dict:
    """Sample Vast.ai API response for testing collectors and normalization."""
    return {
        "gpu_name": "H100_SXM5",
        "num_gpus": 1,
        "dph_total": 3.25,
        "cpu_ram": 128000,
        "disk_space": 500,
        "cpu_cores_effective": 16,
        "geolocation": "US",
        "reliability2": 0.98,
        "verified": True,
        "inet_down": 1000,
        "inet_up": 1000,
    }


@pytest.fixture
def sample_runpod_response() -> dict:
    """Sample RunPod GraphQL response for testing."""
    return {
        "id": "NVIDIA H100 80GB HBM3",
        "communityPrice": 2.99,
        "securePrice": 3.49,
        "communitySpotPrice": 1.99,
        "secureSpotPrice": 2.49,
        "minMemoryInGb": 80,
    }


@pytest.fixture
def sample_aws_spot_record() -> dict:
    """Sample AWS Spot price history record for testing."""
    return {
        "InstanceType": "p5.48xlarge",
        "SpotPrice": "25.60",
        "AvailabilityZone": "us-east-1a",
        "ProductDescription": "Linux/UNIX",
        "Timestamp": "2025-01-15T12:00:00Z",
    }
