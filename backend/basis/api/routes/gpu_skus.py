"""GPU SKU listing endpoint.

Returns the canonical SKUs currently observed, with offer counts, provider
coverage, and the most recent median price. Used by the dashboard's filter
widgets and the SKU picker.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from basis.api.deps import get_db
from basis.db.models import CanonicalOffer, DailyAggregate
from basis.schemas.api import GpuSkuListResponse, GpuSkuSummary

router = APIRouter(prefix="/api/gpu-skus", tags=["gpu-skus"])


@router.get("", response_model=GpuSkuListResponse)
async def list_gpu_skus(db: AsyncSession = Depends(get_db)) -> GpuSkuListResponse:
    """Return all canonical SKUs with offer/provider counts."""
    summary_stmt = select(
        CanonicalOffer.gpu_sku_canonical.label("gpu_sku"),
        func.min(CanonicalOffer.gpu_variant).label("gpu_variant"),
        func.min(CanonicalOffer.vram_gb).label("vram_gb"),
        func.count(CanonicalOffer.id).label("offer_count"),
        func.count(func.distinct(CanonicalOffer.provider)).label("provider_count"),
    ).group_by(CanonicalOffer.gpu_sku_canonical)

    summary_rows = (await db.execute(summary_stmt)).all()

    # Latest median price per SKU, from daily_aggregates all-providers rollup.
    latest_date = (
        await db.execute(select(func.max(DailyAggregate.date)))
    ).scalar_one_or_none()

    latest_medians: dict[str, float] = {}
    if latest_date is not None:
        medians_stmt = select(DailyAggregate.gpu_sku, DailyAggregate.median_price).where(
            DailyAggregate.date == latest_date,
            DailyAggregate.provider.is_(None),
        )
        for row in (await db.execute(medians_stmt)).all():
            latest_medians[row.gpu_sku] = row.median_price

    items = [
        GpuSkuSummary(
            gpu_sku=row.gpu_sku,
            gpu_variant=row.gpu_variant,
            vram_gb=row.vram_gb,
            offer_count=int(row.offer_count),
            provider_count=int(row.provider_count),
            latest_median_price=latest_medians.get(row.gpu_sku),
        )
        for row in sorted(summary_rows, key=lambda r: r.gpu_sku)
    ]

    return GpuSkuListResponse(items=items)
