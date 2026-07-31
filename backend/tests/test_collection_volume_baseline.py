"""Integration tests for collection-volume baseline aggregation.

The classifier logic is covered in test_collection_volume.py; these tests
verify that backfill-tagged rows are excluded from run counts.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from scripts.check_collection_volume import fetch_volume_rows
from sqlalchemy import delete

from basis.db.models import RawObservation

_TEST_SOURCE = "volcheck_backfill_exclusion"


def _observation(
    *,
    collected_at: datetime,
    backfill: bool,
    suffix: str,
) -> RawObservation:
    metadata = {"backfill": True} if backfill else None
    return RawObservation(
        source=_TEST_SOURCE,
        collected_at=collected_at,
        raw_payload={"test": suffix},
        gpu_model_reported="H100",
        price_hourly=1.0,
        provider_metadata=metadata,
    )


@pytest.mark.asyncio
async def test_baseline_excludes_backfill_runs(db_session) -> None:
    """Backfill historical rows must not inflate run count or drag median down."""
    now = datetime.now(UTC)
    normal_run_times = [
        now - timedelta(days=5, hours=12),
        now - timedelta(days=4, hours=12),
        now - timedelta(days=3, hours=12),
        now - timedelta(days=2, hours=12),
    ]
    latest_run_time = now - timedelta(hours=2)

    rows: list[RawObservation] = []
    for index, run_time in enumerate(normal_run_times):
        for i in range(30):
            rows.append(
                _observation(
                    collected_at=run_time,
                    backfill=False,
                    suffix=f"normal-{index}-{i}",
                )
            )
    for i in range(29):
        rows.append(
            _observation(
                collected_at=latest_run_time,
                backfill=False,
                suffix=f"latest-{i}",
            )
        )
    # Same latest timestamp as cron — backfill must not inflate latest_cnt.
    for i in range(40):
        rows.append(
            _observation(
                collected_at=latest_run_time,
                backfill=True,
                suffix=f"latest-backfill-{i}",
            )
        )
    # Hundreds of tiny historical backfill "runs".
    for day in range(15):
        for hour in (3, 9, 15):
            stamp = now - timedelta(days=day, hours=hour)
            rows.append(
                _observation(
                    collected_at=stamp,
                    backfill=True,
                    suffix=f"hist-{day}-{hour}",
                )
            )

    db_session.add_all(rows)
    await db_session.commit()

    try:
        result = await fetch_volume_rows(db_session)
        row = next(r for r in result if r["source"] == _TEST_SOURCE)

        assert row["latest_cnt"] == 29
        assert row["baseline_runs"] == 4
        assert row["baseline_median"] == pytest.approx(30.0)
        assert row["is_recent"] is True
    finally:
        await db_session.execute(
            delete(RawObservation).where(RawObservation.source == _TEST_SOURCE)
        )
        await db_session.commit()
