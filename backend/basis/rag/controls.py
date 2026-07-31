"""Server-side cost and abuse controls for Ask Basis."""

from __future__ import annotations

import math
import time
from collections import defaultdict, deque
from datetime import UTC, date, datetime
from typing import Final

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from basis.db.models import AskDailyUsage

PER_IP_QUESTION_LIMIT: Final = 10
PER_IP_WINDOW_SECONDS: Final = 60 * 60
GLOBAL_DAILY_QUESTION_LIMIT: Final = 200


class RateLimitExceededError(RuntimeError):
    """Raised when an IP has exhausted its sliding-window allowance."""

    def __init__(self, retry_after: int) -> None:
        super().__init__("per-IP question limit reached")
        self.retry_after = retry_after


class DailyCapacityReachedError(RuntimeError):
    """Raised when the global UTC allowance is exhausted."""


class InProcessRateLimiter:
    """Small single-instance sliding-window limiter.

    This store intentionally resets on API restart. The deployment is a
    single portfolio instance; §8 records that restart-reset property.
    """

    def __init__(
        self,
        *,
        limit: int = PER_IP_QUESTION_LIMIT,
        window_seconds: int = PER_IP_WINDOW_SECONDS,
    ) -> None:
        self._limit = limit
        self._window_seconds = window_seconds
        self._requests: defaultdict[str, deque[float]] = defaultdict(deque)

    def check(self, ip_address: str, *, now: float | None = None) -> None:
        """Consume one allowance or raise with a whole-second retry delay."""
        timestamp = time.monotonic() if now is None else now
        cutoff = timestamp - self._window_seconds
        requests = self._requests[ip_address]
        while requests and requests[0] <= cutoff:
            requests.popleft()
        if len(requests) >= self._limit:
            retry_after = max(1, math.ceil(requests[0] + self._window_seconds - timestamp))
            raise RateLimitExceededError(retry_after)
        requests.append(timestamp)

    def clear(self) -> None:
        """Reset the store for deterministic tests."""
        self._requests.clear()


async def consume_daily_capacity(
    session: AsyncSession,
    *,
    day: date | None = None,
    limit: int = GLOBAL_DAILY_QUESTION_LIMIT,
) -> int:
    """Atomically consume one global question slot for a UTC day."""
    utc_day = day or datetime.now(UTC).date()
    statement = (
        insert(AskDailyUsage)
        .values(day=utc_day, question_count=1)
        .on_conflict_do_update(
            index_elements=[AskDailyUsage.day],
            set_={"question_count": AskDailyUsage.question_count + 1},
            where=AskDailyUsage.question_count < limit,
        )
        .returning(AskDailyUsage.question_count)
    )
    consumed = (await session.execute(statement)).scalar_one_or_none()
    await session.commit()
    if consumed is None:
        raise DailyCapacityReachedError("daily capacity reached")
    return int(consumed)
