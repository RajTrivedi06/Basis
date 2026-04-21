"""Abstract base class for all GPU pricing collectors.

Every provider collector must inherit from BaseCollector and implement
the collect() method. The base class provides shared logic for persisting
raw observations and handling errors.

Usage:
    class MyCollector(BaseCollector):
        source_name = "myprovider"

        async def collect(self) -> list[RawObservationCreate]:
            ...
"""

import abc
import logging
from datetime import datetime, timezone

from basis.schemas.raw import RawObservationCreate

logger = logging.getLogger(__name__)


class BaseCollector(abc.ABC):
    """Abstract base for all data collectors.

    Subclasses must set `source_name` and implement `collect()`.
    """

    source_name: str = ""

    @abc.abstractmethod
    async def collect(self) -> list[RawObservationCreate]:
        """Fetch current GPU offers from the provider.

        Returns a list of RawObservationCreate schemas ready for database insert.
        Implementations should:
        - Fetch data from the provider API or page
        - Store the full response in raw_payload
        - Extract gpu_model_reported, price_hourly, region_reported, commitment_type_reported
        - Set collected_at to datetime.now(timezone.utc)
        - Handle network errors gracefully (log and return empty list)
        """
        ...

    async def run(self) -> list[RawObservationCreate]:
        """Execute the collector with error handling.

        Calls collect() and logs the result. Returns the observations
        on success, or an empty list on failure.
        """
        try:
            logger.info("Starting collection from %s", self.source_name)
            observations = await self.collect()
            logger.info(
                "Collected %d observations from %s", len(observations), self.source_name
            )
            return observations
        except Exception:
            logger.exception("Collection failed for %s", self.source_name)
            return []

    @staticmethod
    def now_utc() -> datetime:
        """Return the current UTC timestamp."""
        return datetime.now(timezone.utc)
