"""Providers summary endpoint.

Per-provider aggregates: how many offers, how many distinct canonical SKUs,
when we last saw data, and the provider's median price deviation from the
overall market median on the most recent collection date.

Uses raw canonical_offers + daily_aggregates directly. Cheap query — there
are only four providers.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from basis.api.deps import get_db
from basis.db.models import CanonicalOffer, DailyAggregate
from basis.schemas.api import ProviderListResponse, ProviderSummary

router = APIRouter(prefix="/api/providers", tags=["providers"])


@router.get("", response_model=ProviderListResponse)
async def list_providers(db: AsyncSession = Depends(get_db)) -> ProviderListResponse:
    """Return per-provider summary across the full dataset."""
    # Coverage + freshness: one row per provider.
    summary_stmt = select(
        CanonicalOffer.provider,
        func.count(CanonicalOffer.id).label("offer_count"),
        func.count(func.distinct(CanonicalOffer.gpu_sku_canonical)).label("distinct_skus"),
        func.max(CanonicalOffer.collected_at).label("latest_collection"),
    ).group_by(CanonicalOffer.provider)

    summary_rows = (await db.execute(summary_stmt)).all()

    # Deviation vs. market: compare each provider's median to the all-providers
    # median for (latest common date, gpu_sku) pairs, averaged across SKUs.
    # latest_date is the most recent date any daily_aggregate exists for.
    latest_date = (
        await db.execute(select(func.max(DailyAggregate.date)))
    ).scalar_one_or_none()

    deviation_by_provider: dict[str, float] = {}
    if latest_date is not None:
        # market (provider NULL) medians on latest_date
        market_stmt = select(
            DailyAggregate.gpu_sku, DailyAggregate.median_price
        ).where(
            DailyAggregate.date == latest_date,
            DailyAggregate.provider.is_(None),
        )
        market_rows = (await db.execute(market_stmt)).all()
        market_median = {r.gpu_sku: r.median_price for r in market_rows}

        # per-provider medians on latest_date
        per_provider_stmt = select(
            DailyAggregate.provider,
            DailyAggregate.gpu_sku,
            DailyAggregate.median_price,
        ).where(
            DailyAggregate.date == latest_date,
            DailyAggregate.provider.is_not(None),
        )
        per_provider_rows = (await db.execute(per_provider_stmt)).all()

        # Aggregate per-provider deviations (percent) across all SKUs they cover.
        totals: dict[str, list[float]] = {}
        for row in per_provider_rows:
            market = market_median.get(row.gpu_sku)
            if market is None or market == 0:
                continue
            pct = (row.median_price - market) / market * 100.0
            totals.setdefault(row.provider, []).append(pct)

        for provider, pcts in totals.items():
            deviation_by_provider[provider] = sum(pcts) / len(pcts)

    items = [
        ProviderSummary(
            provider=row.provider,
            offer_count=int(row.offer_count),
            distinct_skus=int(row.distinct_skus),
            latest_collection=row.latest_collection,
            median_deviation_pct=deviation_by_provider.get(row.provider),
        )
        for row in sorted(summary_rows, key=lambda r: r.provider)
    ]

    return ProviderListResponse(items=items)
