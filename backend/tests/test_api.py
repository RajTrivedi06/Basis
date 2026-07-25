"""API smoke tests — one per endpoint.

Each test hits an endpoint with a known-good argument (looking up real
SKUs / IDs from the DB first where needed), asserts 200, and validates the
response body against its Pydantic schema. Catches broken endpoints that
manual testing wouldn't immediately surface — schema drift, silent 500s,
response-shape regressions.

Skips cleanly if the DB is unreachable (see `api_client` fixture).
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from basis.api.routes.basis import _compute_filtered_timeseries
from basis.db.models import BasisDecomposition, CanonicalOffer, RawObservation
from basis.schemas.api import (
    BasisDecompositionResponse,
    BasisTimeseriesResponse,
    DecompositionObservationsResponse,
    DispersionResponse,
    FungibilityMatrixResponse,
    GpuSkuListResponse,
    HealthResponse,
    OfferListResponse,
    ProviderListResponse,
    RawObservationDetail,
    RawObservationExplainResponse,
)


@pytest.mark.asyncio
async def test_health(api_client: AsyncClient) -> None:
    r = await api_client.get("/health")
    assert r.status_code == 200, r.text
    HealthResponse.model_validate(r.json())


@pytest.mark.asyncio
async def test_offers(api_client: AsyncClient) -> None:
    r = await api_client.get("/api/offers", params={"page_size": 3})
    assert r.status_code == 200, r.text
    body = OfferListResponse.model_validate(r.json())
    assert body.page == 1
    assert body.page_size == 3


@pytest.mark.asyncio
async def test_providers(api_client: AsyncClient) -> None:
    r = await api_client.get("/api/providers")
    assert r.status_code == 200, r.text
    ProviderListResponse.model_validate(r.json())


@pytest.mark.asyncio
async def test_gpu_skus(api_client: AsyncClient) -> None:
    r = await api_client.get("/api/gpu-skus")
    assert r.status_code == 200, r.text
    GpuSkuListResponse.model_validate(r.json())


@pytest.mark.asyncio
async def test_fungibility_matrix(api_client: AsyncClient) -> None:
    r = await api_client.get("/api/fungibility-matrix")
    assert r.status_code == 200, r.text
    FungibilityMatrixResponse.model_validate(r.json())


@pytest.mark.asyncio
async def test_dispersion(
    api_client: AsyncClient, db_session: AsyncSession
) -> None:
    sku = await _pick_dispersion_sku(db_session)
    if sku is None:
        pytest.skip("No SKU with dispersion data available.")
    r = await api_client.get(f"/api/dispersion/{sku}")
    assert r.status_code == 200, r.text
    body = DispersionResponse.model_validate(r.json())
    assert body.gpu_sku == sku


@pytest.mark.asyncio
async def test_basis_decomposition(
    api_client: AsyncClient, db_session: AsyncSession
) -> None:
    sku = await _pick_decomposed_sku(db_session)
    if sku is None:
        pytest.skip("No SKU with a basis decomposition available.")
    r = await api_client.get(f"/api/basis/{sku}")
    assert r.status_code == 200, r.text
    body = BasisDecompositionResponse.model_validate(r.json())
    assert body.gpu_sku == sku


@pytest.mark.asyncio
async def test_basis_timeseries(
    api_client: AsyncClient, db_session: AsyncSession
) -> None:
    sku = await _pick_decomposed_sku(db_session)
    if sku is None:
        pytest.skip("No SKU with a basis decomposition available.")
    r = await api_client.get(f"/api/basis/{sku}/timeseries")
    assert r.status_code == 200, r.text
    body = BasisTimeseriesResponse.model_validate(r.json())
    assert body.gpu_sku == sku
    assert len(body.points) >= 1
    # ascending by date
    dates = [p.date for p in body.points]
    assert dates == sorted(dates)


@pytest.mark.slow
@pytest.mark.asyncio
async def test_basis_timeseries_exclude_vast(
    api_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Validate both timeseries paths without encoding a market claim.

    The previous direction assertion inverted as the provider mix changed;
    see ``docs/analysis/2026-07-24-exclude-vast-collapse.md``. This regression
    therefore checks response structure and verifies that an unfiltered
    on-demand recomputation agrees with the precomputed full sample.
    """
    sku = "h100_sxm_80gb"
    if not await _has_decomposition(db_session, sku):
        pytest.skip(f"No decomposition for {sku} in this DB.")

    baseline = await api_client.get(f"/api/basis/{sku}/timeseries")
    assert baseline.status_code == 200, baseline.text
    base_body = BasisTimeseriesResponse.model_validate(baseline.json())
    assert base_body.gpu_sku == sku
    assert base_body.points

    filtered = await api_client.get(
        f"/api/basis/{sku}/timeseries", params={"exclude_providers": "vast"}
    )
    assert filtered.status_code == 200, filtered.text
    filt_body = BasisTimeseriesResponse.model_validate(filtered.json())
    assert filt_body.gpu_sku == sku
    assert filt_body.points

    recomputed = await _compute_filtered_timeseries(
        db_session,
        sku,
        base_body.points[0].date,
        base_body.points[-1].date,
        [],
    )
    base_by_date = {point.date: point for point in base_body.points}
    recomputed_by_date = {point.date: point for point in recomputed}
    overlapping_dates = base_by_date.keys() & recomputed_by_date.keys()
    assert overlapping_dates == base_by_date.keys() == recomputed_by_date.keys()

    for date in overlapping_dates:
        row = recomputed_by_date[date]
        recomputed_pct_residual = (
            row.residual_variance / row.total_variance * 100.0
            if row.total_variance > 0
            else 0.0
        )
        assert abs(base_by_date[date].pct_residual - recomputed_pct_residual) <= 0.05


@pytest.mark.asyncio
async def test_decomposition_observations(
    api_client: AsyncClient, db_session: AsyncSession
) -> None:
    sku = await _pick_decomposed_sku(db_session)
    if sku is None:
        pytest.skip("No SKU with a basis decomposition available.")
    r = await api_client.get(f"/api/decomposition/{sku}/observations")
    assert r.status_code == 200, r.text
    body = DecompositionObservationsResponse.model_validate(r.json())
    assert body.gpu_sku == sku


@pytest.mark.asyncio
async def test_raw_observation(
    api_client: AsyncClient, db_session: AsyncSession
) -> None:
    obs_id = await _pick_raw_observation_id(db_session)
    if obs_id is None:
        pytest.skip("No raw observations available.")
    r = await api_client.get(f"/api/raw-observation/{obs_id}")
    assert r.status_code == 200, r.text
    body = RawObservationDetail.model_validate(r.json())
    assert body.id == obs_id


@pytest.mark.asyncio
async def test_raw_observation_explain(
    api_client: AsyncClient, db_session: AsyncSession
) -> None:
    obs_id = await _pick_raw_observation_id(db_session)
    if obs_id is None:
        pytest.skip("No raw observations available.")
    r = await api_client.get(f"/api/raw-observation/{obs_id}/explain")
    assert r.status_code == 200, r.text
    body = RawObservationExplainResponse.model_validate(r.json())
    assert body.raw_observation_id == obs_id


# --- helpers -----------------------------------------------------------------


async def _pick_dispersion_sku(db: AsyncSession) -> str | None:
    """Return any SKU with at least one canonical offer."""
    stmt = select(CanonicalOffer.gpu_sku_canonical).limit(1)
    return (await db.execute(stmt)).scalar_one_or_none()


async def _pick_decomposed_sku(db: AsyncSession) -> str | None:
    """Return any SKU with an existing basis decomposition row."""
    stmt = select(BasisDecomposition.gpu_sku).limit(1)
    return (await db.execute(stmt)).scalar_one_or_none()


async def _has_decomposition(db: AsyncSession, gpu_sku: str) -> bool:
    """True iff the given SKU has at least one basis_decomposition row."""
    stmt = (
        select(BasisDecomposition.gpu_sku)
        .where(BasisDecomposition.gpu_sku == gpu_sku)
        .limit(1)
    )
    return (await db.execute(stmt)).scalar_one_or_none() is not None


async def _pick_raw_observation_id(db: AsyncSession) -> int | None:
    """Return the id of any raw observation."""
    stmt = select(RawObservation.id).limit(1)
    return (await db.execute(stmt)).scalar_one_or_none()
