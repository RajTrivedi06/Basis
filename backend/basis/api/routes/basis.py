"""Basis decomposition endpoint.

Returns the variance attribution for a (gpu_sku, date) from the
basis_decomposition table. If no date is provided, returns the latest
available decomposition for that SKU.
"""

from __future__ import annotations

import datetime

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from basis.analytics.basis import DecompositionRow, compute_decompositions
from basis.api.deps import get_db
from basis.db.models import BasisDecomposition, CanonicalOffer, RawObservation
from basis.schemas.api import BasisDecompositionResponse, BasisTimeseriesResponse

router = APIRouter(prefix="/api/basis", tags=["basis"])

_BASIS_DETAIL_QUERY_PARAMS = frozenset({"date", "exclude_providers"})


def _to_response(
    row: BasisDecomposition | DecompositionRow,
) -> BasisDecompositionResponse:
    # Duck-types both the ORM model (precomputed-table path) and the
    # analytics dataclass (on-demand path). Shared field names by design;
    # if they ever diverge, this is the place to insert an adapter.
    total = row.total_variance
    explained = (
        row.variance_from_region
        + row.variance_from_commitment
        + row.variance_from_bundle
        + row.variance_from_provider
    )
    pct_explained = (explained / total * 100.0) if total > 0 else 0.0
    pct_residual = (row.residual_variance / total * 100.0) if total > 0 else 0.0
    return BasisDecompositionResponse(
        date=row.date,
        gpu_sku=row.gpu_sku,
        total_variance=row.total_variance,
        variance_from_region=row.variance_from_region,
        variance_from_commitment=row.variance_from_commitment,
        variance_from_bundle=row.variance_from_bundle,
        variance_from_provider=row.variance_from_provider,
        residual_variance=row.residual_variance,
        pct_explained=pct_explained,
        pct_residual=pct_residual,
    )


def _parse_excluded_providers(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [p.strip() for p in raw.split(",") if p.strip()]


async def _compute_filtered_timeseries(
    db: AsyncSession,
    gpu_sku: str,
    since: datetime.date,
    until: datetime.date,
    excluded: list[str],
) -> list[DecompositionRow]:
    """On-demand decomposition with arbitrary providers excluded.

    Mirrors the production analytics path: pulls canonical_offers in the
    window, drops rows for excluded providers, runs the same
    ``compute_decompositions`` used by ``run_analytics.py``. The
    MIN_OBSERVATIONS=5 threshold inside the analytics module silently
    drops thin days rather than failing.
    """
    stmt = select(
        CanonicalOffer.collected_at,
        CanonicalOffer.gpu_sku_canonical,
        CanonicalOffer.provider,
        CanonicalOffer.commitment_type,
        CanonicalOffer.region_country,
        CanonicalOffer.vcpus_bundled,
        CanonicalOffer.ram_gb_bundled,
        CanonicalOffer.storage_gb_bundled,
        CanonicalOffer.price_usd_per_hour,
    ).join(
        RawObservation, CanonicalOffer.raw_observation_id == RawObservation.id
    ).where(
        and_(
            CanonicalOffer.gpu_sku_canonical == gpu_sku,
            func.date(CanonicalOffer.collected_at) >= since,
            func.date(CanonicalOffer.collected_at) <= until,
            CanonicalOffer.provider.notin_(excluded),
            # ADR-0007: recompute must sample the same cron-only population
            # as the batch analytics path, or the two diverge at the
            # backfill boundary.
            func.coalesce(RawObservation.provider_metadata["backfill"].astext, "")
            .notin_(["true", "t", "1"]),
        )
    )
    rows = (await db.execute(stmt)).mappings().all()
    if not rows:
        return []

    df = pd.DataFrame([dict(r) for r in rows])
    df["date"] = pd.to_datetime(df["collected_at"]).dt.date
    decomposed = compute_decompositions(df)
    decomposed.sort(key=lambda r: r.date)
    return decomposed


@router.get("/{gpu_sku}", response_model=BasisDecompositionResponse)
async def get_basis_decomposition(
    gpu_sku: str,
    request: Request,
    date: datetime.date | None = Query(
        None, description="Specific date; defaults to latest available"
    ),
    exclude_providers: str | None = Query(
        None,
        description=(
            "Comma-separated provider names to exclude. When set, recomputes "
            "the requested day from canonical_offers instead of reading the "
            "precomputed basis_decomposition table."
        ),
    ),
    db: AsyncSession = Depends(get_db),
) -> BasisDecompositionResponse:
    """Return the basis decomposition for a GPU SKU on a given date.

    Provider exclusions reuse the timeseries route's on-demand computation so
    identical date/filter inputs cannot diverge between the two endpoints.
    """
    unknown_params = sorted(
        set(request.query_params.keys()) - _BASIS_DETAIL_QUERY_PARAMS
    )
    if unknown_params:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown query parameter(s): {', '.join(unknown_params)}",
        )

    excluded = _parse_excluded_providers(exclude_providers)
    if excluded:
        date_eff = date
        if date_eff is None:
            latest_stmt = select(
                func.max(func.date(CanonicalOffer.collected_at))
            ).where(
                and_(
                    CanonicalOffer.gpu_sku_canonical == gpu_sku,
                    CanonicalOffer.provider.notin_(excluded),
                )
            )
            date_eff = (await db.execute(latest_stmt)).scalar_one_or_none()

        decomposed = (
            await _compute_filtered_timeseries(
                db,
                gpu_sku,
                date_eff,
                date_eff,
                excluded,
            )
            if date_eff is not None
            else []
        )
        if not decomposed:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"No basis decomposition for gpu_sku={gpu_sku!r}"
                    + (f" on {date_eff.isoformat()}" if date_eff else "")
                    + f" after excluding providers={excluded}"
                ),
            )
        return _to_response(decomposed[-1])

    filters = [BasisDecomposition.gpu_sku == gpu_sku]
    if date is not None:
        filters.append(BasisDecomposition.date == date)

    stmt = (
        select(BasisDecomposition)
        .where(and_(*filters))
        .order_by(BasisDecomposition.date.desc())
        .limit(1)
    )
    row = (await db.execute(stmt)).scalar_one_or_none()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail=f"No basis decomposition for gpu_sku={gpu_sku!r}"
            + (f" on {date.isoformat()}" if date else ""),
        )

    return _to_response(row)


@router.get(
    "/{gpu_sku}/timeseries",
    response_model=BasisTimeseriesResponse,
)
async def get_basis_timeseries(
    gpu_sku: str,
    since: datetime.date | None = Query(
        None, description="Start date (inclusive); defaults to 30 days ago"
    ),
    until: datetime.date | None = Query(
        None, description="End date (inclusive); defaults to today"
    ),
    exclude_providers: str | None = Query(
        None,
        description=(
            "Comma-separated provider names to exclude (e.g. 'vast' or "
            "'vast,tensordock'). When set, the response is recomputed on "
            "demand from canonical_offers with those providers removed "
            "instead of reading the precomputed basis_decomposition table."
        ),
    ),
    db: AsyncSession = Depends(get_db),
) -> BasisTimeseriesResponse:
    """Return basis decompositions for a GPU SKU across a date window.

    Default path reads precomputed rows from basis_decomposition (fast,
    Vast-inclusive). When ``exclude_providers`` is set, recomputes the
    decomposition on demand from canonical_offers with those providers
    filtered out. Used by the segment-conditional hero on the landing page.
    """
    today = datetime.date.today()
    until_eff = until or today
    since_eff = since or (until_eff - datetime.timedelta(days=30))

    excluded = _parse_excluded_providers(exclude_providers)

    if excluded:
        decomposed = await _compute_filtered_timeseries(
            db, gpu_sku, since_eff, until_eff, excluded
        )
        if not decomposed:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"No basis decompositions for gpu_sku={gpu_sku!r} "
                    f"between {since_eff.isoformat()} and {until_eff.isoformat()} "
                    f"after excluding providers={excluded}"
                ),
            )
        return BasisTimeseriesResponse(
            gpu_sku=gpu_sku,
            points=[_to_response(r) for r in decomposed],
        )

    stmt = (
        select(BasisDecomposition)
        .where(
            and_(
                BasisDecomposition.gpu_sku == gpu_sku,
                BasisDecomposition.date >= since_eff,
                BasisDecomposition.date <= until_eff,
            )
        )
        .order_by(BasisDecomposition.date.asc())
    )
    rows = (await db.execute(stmt)).scalars().all()

    if not rows:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No basis decompositions for gpu_sku={gpu_sku!r} "
                f"between {since_eff.isoformat()} and {until_eff.isoformat()}"
            ),
        )

    return BasisTimeseriesResponse(
        gpu_sku=gpu_sku,
        points=[_to_response(r) for r in rows],
    )
