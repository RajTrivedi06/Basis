"""Offer listing endpoint.

Queries canonical_offers with optional filters and pagination. Never
returns raw_payload — that's for internal audit only.
"""

from __future__ import annotations

import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from basis.api.deps import PaginationParams, get_db
from basis.db.models import CanonicalOffer
from basis.schemas.api import OfferListResponse, OfferSummary

router = APIRouter(prefix="/api/offers", tags=["offers"])


@router.get("", response_model=OfferListResponse)
async def list_offers(
    gpu_sku: str | None = Query(None, description="Filter by canonical GPU SKU, e.g. h100_sxm_80gb"),
    provider: str | None = Query(None, description="Filter by provider: vast / runpod / aws_spot / tensordock"),
    commitment_type: str | None = Query(None, description="on_demand / spot / reserved_*"),
    region_country: str | None = Query(None, description="ISO-2 country code, e.g. US"),
    since: datetime.datetime | None = Query(None, description="Observations at or after this UTC timestamp"),
    until: datetime.datetime | None = Query(None, description="Observations strictly before this UTC timestamp"),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
) -> OfferListResponse:
    """Return canonical offers matching the filters, paginated."""
    filters = []
    if gpu_sku:
        filters.append(CanonicalOffer.gpu_sku_canonical == gpu_sku)
    if provider:
        filters.append(CanonicalOffer.provider == provider)
    if commitment_type:
        filters.append(CanonicalOffer.commitment_type == commitment_type)
    if region_country:
        filters.append(CanonicalOffer.region_country == region_country)
    if since:
        filters.append(CanonicalOffer.collected_at >= since)
    if until:
        filters.append(CanonicalOffer.collected_at < until)

    where_clause = and_(*filters) if filters else None

    # Total count
    count_stmt = select(func.count(CanonicalOffer.id))
    if where_clause is not None:
        count_stmt = count_stmt.where(where_clause)
    total = (await db.execute(count_stmt)).scalar_one() or 0

    # Page of rows
    rows_stmt = (
        select(CanonicalOffer)
        .order_by(CanonicalOffer.collected_at.desc(), CanonicalOffer.id.desc())
        .limit(pagination.page_size)
        .offset(pagination.offset)
    )
    if where_clause is not None:
        rows_stmt = rows_stmt.where(where_clause)

    rows = (await db.execute(rows_stmt)).scalars().all()

    items = [
        OfferSummary(
            id=r.id,
            collected_at=r.collected_at,
            gpu_sku=r.gpu_sku_canonical,
            provider=r.provider,
            region_country=r.region_country,
            commitment_type=r.commitment_type,
            price_usd_per_hour=r.price_usd_per_hour,
            normalized_price_usd_per_hour=r.normalized_price_usd_per_hour,
        )
        for r in rows
    ]

    return OfferListResponse(
        items=items,
        total=int(total),
        page=pagination.page,
        page_size=pagination.page_size,
    )
