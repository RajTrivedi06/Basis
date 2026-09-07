"""API smoke tests — one per endpoint.

Each test hits an endpoint with a known-good argument (looking up real
SKUs / IDs from the DB first where needed), asserts 200, and validates the
response body against its Pydantic schema. Catches broken endpoints that
manual testing wouldn't immediately surface — schema drift, silent 500s,
response-shape regressions.

Skips cleanly if the DB is unreachable (see `api_client` fixture).
"""

from __future__ import annotations

import datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
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
async def test_basis_decomposition_rejects_unknown_query_params(
    api_client: AsyncClient,
) -> None:
    response = await api_client.get(
        "/api/basis/h100_sxm_80gb",
        params={"exclude_provider": "vast"},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == (
        "Unknown query parameter(s): exclude_provider"
    )


async def _decomposition_window(
    db_session: AsyncSession, sku: str
) -> tuple[datetime.date, datetime.date] | None:
    """Fixture date span for ``sku`` so tests do not depend on the wall clock.

    The default window is the trailing 30 days from *today*; the committed
    fixtures are from July 2026, so an unpinned request 404s in September.
    """
    row = (
        await db_session.execute(
            select(
                func.min(BasisDecomposition.date), func.max(BasisDecomposition.date)
            ).where(BasisDecomposition.gpu_sku == sku)
        )
    ).one()
    if row[0] is None:
        return None
    return row[0], row[1]


@pytest.mark.asyncio
async def test_basis_timeseries(
    api_client: AsyncClient, db_session: AsyncSession
) -> None:
    sku = await _pick_decomposed_sku(db_session)
    if sku is None:
        pytest.skip("No SKU with a basis decomposition available.")
    window = await _decomposition_window(db_session, sku)
    assert window is not None
    since, until = window
    r = await api_client.get(
        f"/api/basis/{sku}/timeseries",
        params={"since": since.isoformat(), "until": until.isoformat()},
    )
    assert r.status_code == 200, r.text
    body = BasisTimeseriesResponse.model_validate(r.json())
    assert body.gpu_sku == sku
    assert len(body.points) >= 1
    # ascending by date
    dates = [p.date for p in body.points]
    assert dates == sorted(dates)


@pytest.mark.slow
@pytest.mark.asyncio
async def test_basis_timeseries_exclude_vast_and_single_day_agree(
    api_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Validate filtered timeseries and single-day paths without a market claim.

    The previous direction assertion inverted as the provider mix changed;
    see ``docs/analysis/2026-07-24-exclude-vast-collapse.md``. This regression
    therefore checks response structure and requires the filtered single-day
    and one-day-timeseries responses to match. It intentionally does not compare
    the stored pooled table with an on-demand recomputation: after ADR-0007, a
    local database may not have regenerated its precomputed rows yet.
    """
    sku = "h100_sxm_80gb"
    if not await _has_decomposition(db_session, sku):
        pytest.skip(f"No decomposition for {sku} in this DB.")

    window = await _decomposition_window(db_session, sku)
    assert window is not None
    pinned = {"since": window[0].isoformat(), "until": window[1].isoformat()}
    baseline = await api_client.get(f"/api/basis/{sku}/timeseries", params=pinned)
    assert baseline.status_code == 200, baseline.text
    base_body = BasisTimeseriesResponse.model_validate(baseline.json())
    assert base_body.gpu_sku == sku
    assert base_body.points

    filtered = await api_client.get(
        f"/api/basis/{sku}/timeseries", params={**pinned, "exclude_providers": "vast"}
    )
    assert filtered.status_code == 200, filtered.text
    filt_body = BasisTimeseriesResponse.model_validate(filtered.json())
    assert filt_body.gpu_sku == sku
    assert filt_body.points

    base_by_date = {point.date: point for point in base_body.points}
    # Regression: the single-day route must not silently ignore the same
    # exclusion accepted by the timeseries route.
    filtered_by_date = {point.date: point for point in filt_body.points}
    changed_dates = sorted(
        date
        for date in base_by_date.keys() & filtered_by_date.keys()
        if abs(
            base_by_date[date].pct_residual
            - filtered_by_date[date].pct_residual
        )
        > 1e-6
    )
    assert changed_dates, "fixture must contain a day where the exclusion has an effect"
    comparison_date = changed_dates[-1]
    comparison_params = {
        "since": comparison_date.isoformat(),
        "until": comparison_date.isoformat(),
        "exclude_providers": "vast",
    }
    one_day_series = await api_client.get(
        f"/api/basis/{sku}/timeseries",
        params=comparison_params,
    )
    assert one_day_series.status_code == 200, one_day_series.text
    series_body = BasisTimeseriesResponse.model_validate(one_day_series.json())
    assert len(series_body.points) == 1

    single_day = await api_client.get(
        f"/api/basis/{sku}",
        params={
            "date": comparison_date.isoformat(),
            "exclude_providers": "vast",
        },
    )
    assert single_day.status_code == 200, single_day.text
    single_body = BasisDecompositionResponse.model_validate(single_day.json())
    series_point = series_body.points[0]

    assert single_body.date == series_point.date == comparison_date
    assert single_body.gpu_sku == series_point.gpu_sku == sku
    for field in (
        "total_variance",
        "variance_from_region",
        "variance_from_commitment",
        "variance_from_bundle",
        "variance_from_provider",
        "residual_variance",
        "pct_explained",
        "pct_residual",
    ):
        assert getattr(single_body, field) == pytest.approx(
            getattr(series_point, field),
            rel=1e-9,
            abs=1e-12,
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
