"""Normalization pipeline.

Processes raw observations into canonical offers by applying GPU name
canonicalization, commitment type mapping, region normalization, and
bundle extraction.

This is the main entry point for the normalization layer.
"""

import logging

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from basis.db.models import RawObservation, CanonicalOffer
from basis.normalization.canonicalize import canonicalize_gpu, get_gpu_variant, get_vram_gb
from basis.normalization.commitment import canonicalize_commitment
from basis.normalization.region import normalize_region
from basis.normalization.bundle import extract_bundle

logger = logging.getLogger(__name__)


def normalize_observation(raw: RawObservation) -> CanonicalOffer | None:
    """Convert a single raw observation into a canonical offer.

    Returns None if the GPU name cannot be mapped (unknown GPU).
    """
    # 1. Canonicalize GPU name
    gpu_sku = canonicalize_gpu(raw.gpu_model_reported)
    if gpu_sku is None:
        return None  # Unknown GPU — skip rather than guess

    # 2. Get GPU variant and VRAM
    variant = get_gpu_variant(gpu_sku)
    vram = get_vram_gb(gpu_sku)

    # 3. Normalize commitment type
    commitment = canonicalize_commitment(raw.commitment_type_reported)

    # 4. Normalize region
    region = normalize_region(raw.source, raw.region_reported)

    # 5. Extract bundle info
    bundle = extract_bundle(raw.source, raw.provider_metadata)

    return CanonicalOffer(
        raw_observation_id=raw.id,
        collected_at=raw.collected_at,
        gpu_sku_canonical=gpu_sku,
        gpu_variant=variant,
        vram_gb=vram,
        region_country=region.country,
        region_state=region.state,
        region_city=region.city,
        provider=raw.source,
        commitment_type=commitment,
        vcpus_bundled=bundle.vcpus,
        ram_gb_bundled=bundle.ram_gb,
        storage_gb_bundled=bundle.storage_gb,
        networking_type=bundle.networking_type,
        verification_tier=bundle.verification_tier,
        price_usd_per_hour=raw.price_hourly,
        normalized_price_usd_per_hour=None,  # Filled in later by analytics
    )


async def run_normalization(session: AsyncSession, batch_size: int = 1000) -> dict:
    """Normalize all raw observations that don't yet have canonical offers.

    Processes in batches, using an id-based cursor to advance between
    batches. The cursor is necessary because the `already_normalized` filter
    only excludes rows that successfully produced a canonical offer;
    skipped rows (unknown GPU) stay in the candidate pool. Without a cursor
    the loop would re-read and re-skip the same rows forever. A numeric
    offset can't be used in combination with the filter — after batch 1,
    each `offset += batch_size` advances past rows the filter has since
    excluded, silently dropping unprocessed rows.
    """
    already_normalized = select(CanonicalOffer.raw_observation_id)

    # Count total unnormalized upfront so logging reports progress against
    # a stable denominator. The loop doesn't depend on this number.
    total_to_process = (
        await session.execute(
            select(func.count(RawObservation.id)).where(
                RawObservation.id.notin_(already_normalized)
            )
        )
    ).scalar() or 0
    logger.info("Found %d raw observations to normalize", total_to_process)

    processed = 0
    created = 0
    skipped = 0
    last_id = 0  # Cursor: next batch fetches rows with id > last_id.

    while True:
        batch_query = (
            select(RawObservation)
            .where(RawObservation.id.notin_(already_normalized))
            .where(RawObservation.id > last_id)
            .order_by(RawObservation.id)
            .limit(batch_size)
        )
        batch = (await session.execute(batch_query)).scalars().all()

        if not batch:
            break

        canonical_offers = []
        for raw in batch:
            offer = normalize_observation(raw)
            if offer is not None:
                canonical_offers.append(offer)
                created += 1
            else:
                skipped += 1
            processed += 1

        last_id = batch[-1].id

        if canonical_offers:
            session.add_all(canonical_offers)
            await session.commit()

        logger.info(
            "Progress: %d/%d processed, %d created, %d skipped",
            processed, total_to_process, created, skipped,
        )

    summary = {
        "total_processed": processed,
        "canonical_offers_created": created,
        "skipped_unknown_gpu": skipped,
    }
    logger.info("Normalization complete: %s", summary)
    return summary
