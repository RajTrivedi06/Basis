"""Fungibility matrix endpoint.

Returns one row per canonical SKU at its latest observed date, joining the
all-providers daily aggregate with the basis decomposition for the same
(date, gpu_sku). SKUs that have not yet crossed the decomposition threshold
return null residual fields — the frontend renders those as "accumulating".

Reads aggregates only. Does not invoke analytics at request time.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from basis.api.deps import get_db
from basis.db.models import BasisDecomposition, DailyAggregate
from basis.schemas.api import FungibilityMatrixResponse, FungibilityMatrixRow

router = APIRouter(prefix="/api/fungibility-matrix", tags=["fungibility"])


@router.get("", response_model=FungibilityMatrixResponse)
async def get_fungibility_matrix(
    db: AsyncSession = Depends(get_db),
) -> FungibilityMatrixResponse:
    """Return the latest-date row per canonical SKU with residual attribution."""
    latest_per_sku = (
        select(
            DailyAggregate.gpu_sku.label("gpu_sku"),
            func.max(DailyAggregate.date).label("latest_date"),
        )
        .where(DailyAggregate.provider.is_(None))
        .group_by(DailyAggregate.gpu_sku)
        .subquery()
    )

    rows_stmt = (
        select(
            latest_per_sku.c.gpu_sku,
            latest_per_sku.c.latest_date,
            DailyAggregate.median_price,
            DailyAggregate.observation_count,
            BasisDecomposition.total_variance,
            BasisDecomposition.residual_variance,
        )
        .select_from(latest_per_sku)
        .join(
            DailyAggregate,
            and_(
                DailyAggregate.gpu_sku == latest_per_sku.c.gpu_sku,
                DailyAggregate.date == latest_per_sku.c.latest_date,
                DailyAggregate.provider.is_(None),
            ),
        )
        .outerjoin(
            BasisDecomposition,
            and_(
                BasisDecomposition.gpu_sku == latest_per_sku.c.gpu_sku,
                BasisDecomposition.date == latest_per_sku.c.latest_date,
            ),
        )
    )

    provider_count_stmt = (
        select(
            DailyAggregate.gpu_sku,
            DailyAggregate.date,
            func.count(func.distinct(DailyAggregate.provider)).label("provider_count"),
        )
        .where(DailyAggregate.provider.is_not(None))
        .group_by(DailyAggregate.gpu_sku, DailyAggregate.date)
    )

    rows = (await db.execute(rows_stmt)).all()
    provider_counts = {
        (r.gpu_sku, r.date): int(r.provider_count)
        for r in (await db.execute(provider_count_stmt)).all()
    }

    items: list[FungibilityMatrixRow] = []
    for r in rows:
        total = r.total_variance
        residual = r.residual_variance
        pct_residual: float | None = None
        if total is not None and residual is not None and total > 0:
            pct_residual = residual / total * 100.0

        items.append(
            FungibilityMatrixRow(
                gpu_sku=r.gpu_sku,
                latest_date=r.latest_date,
                median_price=r.median_price,
                observation_count=int(r.observation_count),
                provider_count=provider_counts.get((r.gpu_sku, r.latest_date), 0),
                total_variance=total,
                residual_variance=residual,
                pct_residual=pct_residual,
            )
        )

    items.sort(key=lambda row: row.gpu_sku)
    return FungibilityMatrixResponse(items=items)
