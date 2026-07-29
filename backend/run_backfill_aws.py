"""One-shot AWS Spot Price History backfill.

Backfilled ``collected_at`` is the provider record's own ``Timestamp`` from
``describe_spot_price_history``. That timestamp is the price observation time;
using script execution time would collapse 90 days into one analytics bucket.
Each row also records ``provider_metadata.backfill = true`` and the actual UTC
run time in ``provider_metadata.backfill_executed_at``.

Before inserting, the script loads existing ``aws_spot`` raw rows with one
SELECT and deduplicates on ``(instance_type, availability_zone, Timestamp)``.
For existing rows, instance type and availability zone are read first from
``provider_metadata.instance_type`` / ``provider_metadata.availability_zone``
and fall back to ``raw_payload.InstanceType`` /
``raw_payload.AvailabilityZone``. The timestamp is always read from
``raw_payload.Timestamp``—never from ``collected_at``—and normalized to UTC.
Rows with an incomplete or ambiguous key are ignored rather than guessed.

This script is intentionally not registered as a scheduled collector. The
production EC2 invocation must be performed once by the Manager in the
Raj-approved window coordinated with Task 2.4.
"""

from __future__ import annotations

import asyncio
import datetime
import logging
from dataclasses import dataclass
from typing import Any

import boto3
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from basis.collectors.aws_spot import fetch_spot_history, parse_spot_record
from basis.collectors.persist import save_observations
from basis.db.engine import async_session_factory
from basis.db.models import RawObservation
from basis.schemas.raw import RawObservationCreate

logger = logging.getLogger(__name__)

BACKFILL_DAYS = 90
SpotKey = tuple[str, str, datetime.datetime]


@dataclass
class BackfillBatch:
    """Prepared observations plus auditable skip counts."""

    observations: list[RawObservationCreate]
    duplicate_existing: int = 0
    duplicate_batch: int = 0
    invalid_key: int = 0
    unparseable: int = 0


def parse_utc_timestamp(value: object) -> datetime.datetime | None:
    """Parse an aware AWS timestamp and normalize it to UTC."""
    if isinstance(value, datetime.datetime):
        parsed = value
    elif isinstance(value, str):
        normalized = f"{value[:-1]}+00:00" if value.endswith("Z") else value
        try:
            parsed = datetime.datetime.fromisoformat(normalized)
        except ValueError:
            return None
    else:
        return None

    if parsed.tzinfo is None or parsed.utcoffset() is None:
        return None
    return parsed.astimezone(datetime.UTC)


def spot_key_from_record(record: dict[str, Any]) -> SpotKey | None:
    """Extract the strict dedupe key from a provider record."""
    instance_type = record.get("InstanceType")
    availability_zone = record.get("AvailabilityZone")
    timestamp = parse_utc_timestamp(record.get("Timestamp"))
    if not isinstance(instance_type, str) or not instance_type:
        return None
    if not isinstance(availability_zone, str) or not availability_zone:
        return None
    if timestamp is None:
        return None
    return instance_type, availability_zone, timestamp


def spot_key_from_existing(
    provider_metadata: dict[str, Any] | None,
    raw_payload: dict[str, Any],
) -> SpotKey | None:
    """Extract a key from an existing raw without relying on collected_at."""
    metadata = provider_metadata or {}
    instance_type = metadata.get("instance_type") or raw_payload.get("InstanceType")
    availability_zone = metadata.get("availability_zone") or raw_payload.get("AvailabilityZone")
    timestamp = parse_utc_timestamp(raw_payload.get("Timestamp"))
    if not isinstance(instance_type, str) or not instance_type:
        return None
    if not isinstance(availability_zone, str) or not availability_zone:
        return None
    if timestamp is None:
        return None
    return instance_type, availability_zone, timestamp


async def load_existing_spot_keys(
    session: AsyncSession,
) -> tuple[set[SpotKey], int]:
    """Load all existing AWS Spot keys in one SELECT."""
    result = await session.execute(
        select(RawObservation.provider_metadata, RawObservation.raw_payload).where(
            RawObservation.source == "aws_spot"
        )
    )
    keys: set[SpotKey] = set()
    invalid = 0
    for provider_metadata, raw_payload in result.all():
        key = spot_key_from_existing(provider_metadata, raw_payload)
        if key is None:
            invalid += 1
            continue
        keys.add(key)
    return keys, invalid


def build_backfill_batch(
    records: list[dict[str, Any]],
    *,
    executed_at: datetime.datetime,
    existing_keys: set[SpotKey],
) -> BackfillBatch:
    """Build immutable raw rows, excluding existing and in-response duplicates."""
    batch = BackfillBatch(observations=[])
    batch_keys: set[SpotKey] = set()
    execution_timestamp = executed_at.astimezone(datetime.UTC).isoformat()

    for record in records:
        key = spot_key_from_record(record)
        if key is None:
            batch.invalid_key += 1
            logger.warning("Skipping AWS backfill record with incomplete dedupe key")
            continue
        if key in existing_keys:
            batch.duplicate_existing += 1
            continue
        if key in batch_keys:
            batch.duplicate_batch += 1
            continue

        observation = parse_spot_record(
            record,
            key[2],
            provider_metadata_extra={
                "backfill": True,
                "backfill_executed_at": execution_timestamp,
            },
        )
        if observation is None:
            batch.unparseable += 1
            continue

        batch_keys.add(key)
        batch.observations.append(observation)

    return batch


async def main() -> None:
    """Fetch 90 days, deduplicate against raw history, and persist once."""
    if boto3.Session().get_credentials() is None:
        logger.warning(
            "AWS credentials not findable (env, IAM role, or profile); "
            "backfill did not fetch or write anything"
        )
        return

    executed_at = datetime.datetime.now(datetime.UTC)
    start_time = executed_at - datetime.timedelta(days=BACKFILL_DAYS)
    records = await fetch_spot_history(start_time, executed_at)

    async with async_session_factory() as session:
        existing_keys, invalid_existing = await load_existing_spot_keys(session)
        batch = build_backfill_batch(
            records,
            executed_at=executed_at,
            existing_keys=existing_keys,
        )
        inserted = await save_observations(session, batch.observations)

    observation_dates = {
        observation.collected_at.astimezone(datetime.UTC).date()
        for observation in batch.observations
    }
    logger.info(
        "AWS backfill complete: fetched=%d inserted=%d "
        "duplicates_existing=%d duplicates_batch=%d "
        "invalid_existing_keys=%d invalid_fetched_keys=%d unparseable=%d "
        "distinct_utc_dates=%d",
        len(records),
        inserted,
        batch.duplicate_existing,
        batch.duplicate_batch,
        invalid_existing,
        batch.invalid_key,
        batch.unparseable,
        len(observation_dates),
    )


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s  %(message)s",
        datefmt="%H:%M:%S",
    )
    asyncio.run(main())
