"""Behavioral tests for Ask Basis server-side abuse controls."""

from __future__ import annotations

from datetime import date

import pytest
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from basis.db.models import AskDailyUsage
from basis.rag.controls import (
    DailyCapacityReachedError,
    InProcessRateLimiter,
    RateLimitExceededError,
    consume_daily_capacity,
)


def test_sliding_window_rejects_eleventh_request_with_retry_after() -> None:
    limiter = InProcessRateLimiter(limit=10, window_seconds=3_600)

    for offset in range(10):
        limiter.check("203.0.113.9", now=1_000.0 + offset)

    with pytest.raises(RateLimitExceededError) as exc_info:
        limiter.check("203.0.113.9", now=1_010.0)

    assert exc_info.value.retry_after == 3_590

    limiter.check("203.0.113.9", now=4_601.0)


@pytest.mark.asyncio
async def test_daily_capacity_is_atomic_and_stops_at_limit(
    db_session: AsyncSession,
) -> None:
    test_day = date(2099, 1, 2)
    await db_session.execute(delete(AskDailyUsage).where(AskDailyUsage.day == test_day))
    await db_session.commit()
    try:
        assert await consume_daily_capacity(db_session, day=test_day, limit=2) == 1
        assert await consume_daily_capacity(db_session, day=test_day, limit=2) == 2
        with pytest.raises(DailyCapacityReachedError):
            await consume_daily_capacity(db_session, day=test_day, limit=2)
    finally:
        await db_session.execute(delete(AskDailyUsage).where(AskDailyUsage.day == test_day))
        await db_session.commit()
