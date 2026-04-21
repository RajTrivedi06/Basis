"""Dispersion metrics endpoint.

Reads materialized daily_aggregates rather than recomputing from
canonical_offers. IQR is computed on the fly from stored p25/p75.

Coefficient of variation requires raw observations (we only store
percentiles) and is returned as None for now — could be added as a
separate column in a future migration if it's needed on the dashboard.
"""

from __future__ import annotations

import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from basis.api.deps import get_db
from basis.db.models import DailyAggregate
from basis.schemas.api import DispersionPoint, DispersionResponse

router = APIRouter(prefix="/api/dispersion", tags=["dispersion"])


@router.get("/{gpu_sku}", response_model=DispersionResponse)
async def get_dispersion(
    gpu_sku: str,
    since: datetime.date | None = Query(None, description="Include points at or after this date"),
    until: datetime.date | None = Query(None, description="Include points at or before this date"),
    provider: str | None = Query(
        None,
        description="Filter to one provider (default: all-providers rollup)",
    ),
    db: AsyncSession = Depends(get_db),
) -> DispersionResponse:
    """Return the dispersion time series for a GPU SKU."""
    filters = [DailyAggregate.gpu_sku == gpu_sku]

    if provider is None:
        # all-providers rollup rows have provider NULL
        filters.append(DailyAggregate.provider.is_(None))
    else:
        filters.append(DailyAggregate.provider == provider)

    if since:
        filters.append(DailyAggregate.date >= since)
    if until:
        filters.append(DailyAggregate.date <= until)

    stmt = (
        select(DailyAggregate)
        .where(and_(*filters))
        .order_by(DailyAggregate.date.asc())
    )
    rows = (await db.execute(stmt)).scalars().all()

    if not rows and provider is not None:
        # Help the caller realize they may have asked for a non-existent slice.
        raise HTTPException(
            status_code=404,
            detail=f"No dispersion data for gpu_sku={gpu_sku!r} provider={provider!r}",
        )

    points = [
        DispersionPoint(
            date=r.date,
            gpu_sku=gpu_sku,
            observation_count=r.observation_count,
            median_price=r.median_price,
            p25_price=r.p25_price,
            p75_price=r.p75_price,
            iqr=max(0.0, r.p75_price - r.p25_price),
            coefficient_of_variation=None,
        )
        for r in rows
    ]

    return DispersionResponse(gpu_sku=gpu_sku, points=points)
