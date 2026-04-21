"""Basis decomposition endpoint.

Returns the variance attribution for a (gpu_sku, date) from the
basis_decomposition table. If no date is provided, returns the latest
available decomposition for that SKU.
"""

from __future__ import annotations

import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from basis.api.deps import get_db
from basis.db.models import BasisDecomposition
from basis.schemas.api import BasisDecompositionResponse

router = APIRouter(prefix="/api/basis", tags=["basis"])


@router.get("/{gpu_sku}", response_model=BasisDecompositionResponse)
async def get_basis_decomposition(
    gpu_sku: str,
    date: datetime.date | None = Query(
        None, description="Specific date; defaults to latest available"
    ),
    db: AsyncSession = Depends(get_db),
) -> BasisDecompositionResponse:
    """Return the basis decomposition for a GPU SKU on a given date."""
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

    explained = (
        row.variance_from_region
        + row.variance_from_commitment
        + row.variance_from_bundle
        + row.variance_from_provider
    )
    total = row.total_variance
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
