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


@pytest.mark.asyncio
async def test_basis_timeseries_exclude_vast(
    api_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Exclusion path: recompute on demand with Vast filtered out.

    Pinned to ``h100_sxm_80gb`` — the SKU the segment-conditional headline
    is anchored to. The 2026-05-13 analysis report shows median residual
    share moving from ~59% (Vast incl.) to ~89% (Vast excl.) over an
    18-day window. We assert a much weaker version of the same claim:
    residual must rise by at least 5 pp.

    Skips when the DB doesn't carry the H100 SXM 80GB decomposition or
    when fewer than 10 days of data are present — the direction of the
    Vast shift is only stable on production-era samples; on the v1
    3-day fixture both means land within ~1 pp of each other.
    """
    sku = "h100_sxm_80gb"
    if not await _has_decomposition(db_session, sku):
        pytest.skip(f"No decomposition for {sku} in this DB.")

    baseline = await api_client.get(f"/api/basis/{sku}/timeseries")
    if baseline.status_code != 200:
        pytest.skip(f"Baseline timeseries unavailable: {baseline.status_code}")
    base_body = BasisTimeseriesResponse.model_validate(baseline.json())

    # Sanity that the basic endpoint contract still holds under the
    # filter, even when the small-sample assertion can't fire.
    filtered = await api_client.get(
        f"/api/basis/{sku}/timeseries", params={"exclude_providers": "vast"}
    )
    if filtered.status_code == 404:
        pytest.skip("Excluding Vast left nothing to decompose.")
    assert filtered.status_code == 200, filtered.text
    filt_body = BasisTimeseriesResponse.model_validate(filtered.json())
    assert filt_body.gpu_sku == sku
    assert len(filt_body.points) >= 1

    if len(base_body.points) < 10:
        pytest.skip(
            f"Need ≥10 days for the Vast-shift assertion; got {len(base_body.points)}."
        )

    base_mean = sum(p.pct_residual for p in base_body.points) / len(base_body.points)
    filt_mean = sum(p.pct_residual for p in filt_body.points) / len(filt_body.points)
    # Direction-specific to H100 SXM 80GB: Vast contributes large
    # attributable variance (different verified-tier hosts, geographic
    # spread, bundled-resource diversity); removing it strips out the
    # offers observable factors can explain, raising residual share.
    assert filt_mean > base_mean + 5.0, (
        f"Excluding vast did not raise residual share for {sku} as expected: "
        f"base={base_mean:.1f}% filtered={filt_mean:.1f}%"
    )


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
