"""Provenance drilldown endpoints (v2 Phase B).

Three endpoints that expose the audit trail from decomposition bucket →
canonical offers → raw observation → normalization attribution:

- GET /api/decomposition/{gpu_sku}/observations
- GET /api/raw-observation/{id}
- GET /api/raw-observation/{id}/explain

The explain endpoint is the sole caller of the `explain_*` normalization
functions, per ADR 0004. These routes read only; none invokes analytics
or normalization writes at request time.
"""

from __future__ import annotations

import dataclasses
import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from basis.api.deps import get_db
from basis.db.models import BasisDecomposition, CanonicalOffer, RawObservation
from basis.normalization.bundle import explain_extract_bundle
from basis.normalization.canonicalize import explain_canonicalize_gpu
from basis.normalization.commitment import explain_canonicalize_commitment
from basis.normalization.region import explain_normalize_region
from basis.schemas.api import (
    BundleExtractionExplanationSchema,
    CommitmentCanonicalizationExplanationSchema,
    DecompositionObservation,
    DecompositionObservationsResponse,
    GpuCanonicalizationExplanationSchema,
    RawObservationDetail,
    RawObservationExplainResponse,
    RegionNormalizationExplanationSchema,
)

router = APIRouter(tags=["provenance"])


@router.get(
    "/api/decomposition/{gpu_sku}/observations",
    response_model=DecompositionObservationsResponse,
)
async def get_decomposition_observations(
    gpu_sku: str,
    date: datetime.date | None = Query(
        None, description="Date of the decomposition bucket; defaults to latest"
    ),
    db: AsyncSession = Depends(get_db),
) -> DecompositionObservationsResponse:
    """Return canonical offers that contributed to a given (gpu_sku, date) bucket."""
    if date is None:
        latest_stmt = (
            select(BasisDecomposition.date)
            .where(BasisDecomposition.gpu_sku == gpu_sku)
            .order_by(BasisDecomposition.date.desc())
            .limit(1)
        )
        latest = (await db.execute(latest_stmt)).scalar_one_or_none()
        if latest is None:
            raise HTTPException(
                status_code=404,
                detail=f"No decomposition exists for gpu_sku={gpu_sku!r}",
            )
        date = latest

    start_utc = datetime.datetime.combine(date, datetime.time.min, tzinfo=datetime.UTC)
    end_utc = start_utc + datetime.timedelta(days=1)

    offers_stmt = (
        select(CanonicalOffer)
        .where(
            and_(
                CanonicalOffer.gpu_sku_canonical == gpu_sku,
                CanonicalOffer.collected_at >= start_utc,
                CanonicalOffer.collected_at < end_utc,
            )
        )
        .order_by(CanonicalOffer.collected_at.asc(), CanonicalOffer.id.asc())
    )
    offers = (await db.execute(offers_stmt)).scalars().all()

    items = [
        DecompositionObservation(
            canonical_offer_id=o.id,
            raw_observation_id=o.raw_observation_id,
            collected_at=o.collected_at,
            provider=o.provider,
            price_usd_per_hour=o.price_usd_per_hour,
            commitment_type=o.commitment_type,
            region_country=o.region_country,
            region_state=o.region_state,
            region_city=o.region_city,
            vcpus_bundled=o.vcpus_bundled,
            ram_gb_bundled=o.ram_gb_bundled,
            storage_gb_bundled=o.storage_gb_bundled,
            verification_tier=o.verification_tier,
        )
        for o in offers
    ]
    return DecompositionObservationsResponse(gpu_sku=gpu_sku, date=date, items=items)


@router.get(
    "/api/raw-observation/{obs_id}",
    response_model=RawObservationDetail,
)
async def get_raw_observation(
    obs_id: int,
    db: AsyncSession = Depends(get_db),
) -> RawObservationDetail:
    """Return a raw observation row including its full provider payload."""
    row = await db.get(RawObservation, obs_id)
    if row is None:
        raise HTTPException(
            status_code=404,
            detail=f"No raw observation with id={obs_id}",
        )
    return RawObservationDetail(
        id=row.id,
        source=row.source,
        collected_at=row.collected_at,
        gpu_model_reported=row.gpu_model_reported,
        price_hourly=row.price_hourly,
        region_reported=row.region_reported,
        commitment_type_reported=row.commitment_type_reported,
        provider_metadata=row.provider_metadata,
        raw_payload=row.raw_payload,
    )


@router.get(
    "/api/raw-observation/{obs_id}/explain",
    response_model=RawObservationExplainResponse,
)
async def explain_raw_observation(
    obs_id: int,
    db: AsyncSession = Depends(get_db),
) -> RawObservationExplainResponse:
    """Run a raw observation through every explain_* function and return the trail.

    Per ADR 0004: this route is the sole caller of the `explain_*` functions.
    """
    row = await db.get(RawObservation, obs_id)
    if row is None:
        raise HTTPException(
            status_code=404,
            detail=f"No raw observation with id={obs_id}",
        )

    gpu_exp = explain_canonicalize_gpu(row.gpu_model_reported)
    commit_exp = explain_canonicalize_commitment(row.commitment_type_reported)
    region_exp = explain_normalize_region(row.source, row.region_reported)
    bundle_exp = explain_extract_bundle(row.source, row.provider_metadata)

    return RawObservationExplainResponse(
        raw_observation_id=row.id,
        source=row.source,
        gpu=GpuCanonicalizationExplanationSchema(**dataclasses.asdict(gpu_exp)),
        commitment=CommitmentCanonicalizationExplanationSchema(
            **dataclasses.asdict(commit_exp)
        ),
        region=RegionNormalizationExplanationSchema(**dataclasses.asdict(region_exp)),
        bundle=BundleExtractionExplanationSchema(**dataclasses.asdict(bundle_exp)),
    )
