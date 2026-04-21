"""Persistence helpers for saving collector results to the database."""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from basis.db.models import RawObservation
from basis.schemas.raw import RawObservationCreate

logger = logging.getLogger(__name__)


async def save_observations(
    session: AsyncSession, observations: list[RawObservationCreate]
) -> int:
    """Insert a list of raw observations into the database.

    Returns the number of rows inserted.
    """
    if not observations:
        return 0

    rows = [
        RawObservation(
            source=obs.source,
            collected_at=obs.collected_at,
            raw_payload=obs.raw_payload,
            gpu_model_reported=obs.gpu_model_reported,
            price_hourly=obs.price_hourly,
            region_reported=obs.region_reported,
            commitment_type_reported=obs.commitment_type_reported,
            provider_metadata=obs.provider_metadata,
        )
        for obs in observations
    ]

    session.add_all(rows)
    await session.commit()
    logger.info("Saved %d raw observations to database", len(rows))
    return len(rows)
