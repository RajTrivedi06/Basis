"""AWS Spot backfill and shared collector-path tests."""

from __future__ import annotations

import datetime
from typing import Any

import pytest
import run_backfill_aws

from basis.collectors import aws_spot
from basis.collectors.aws_spot import AWSSpotCollector


def _record(
    timestamp: datetime.datetime | str,
    *,
    instance_type: str = "p5.48xlarge",
    availability_zone: str = "us-east-1a",
    price: str = "25.60",
) -> dict[str, Any]:
    return {
        "InstanceType": instance_type,
        "SpotPrice": price,
        "AvailabilityZone": availability_zone,
        "ProductDescription": "Linux/UNIX",
        "Timestamp": timestamp,
    }


@pytest.mark.parametrize("include_end_time", [False, True])
def test_shared_fetch_path_paginates_and_preserves_window(
    monkeypatch: pytest.MonkeyPatch,
    include_end_time: bool,
) -> None:
    """The shared fetch path retains all paginator pages and optional EndTime."""
    start_time = datetime.datetime(2026, 4, 30, tzinfo=datetime.UTC)
    end_time = datetime.datetime(2026, 7, 29, tzinfo=datetime.UTC) if include_end_time else None
    first = _record(start_time)
    second = _record(
        start_time + datetime.timedelta(hours=1),
        availability_zone="us-east-1b",
    )
    requests: list[dict[str, Any]] = []

    class FakePaginator:
        def paginate(self, **kwargs: Any) -> list[dict[str, Any]]:
            requests.append(kwargs)
            return [
                {"SpotPriceHistory": [first]},
                {"SpotPriceHistory": [second]},
            ]

    class FakeClient:
        def get_paginator(self, operation: str) -> FakePaginator:
            assert operation == "describe_spot_price_history"
            return FakePaginator()

    def fake_client(service: str, *, config: Any) -> FakeClient:
        assert service == "ec2"
        assert config.region_name == "us-east-1"
        return FakeClient()

    monkeypatch.setattr(aws_spot.boto3, "client", fake_client)

    records = aws_spot._fetch_region_spot_history_sync(
        "us-east-1",
        ["p5.48xlarge"],
        start_time,
        end_time,
    )

    assert records == [first, second]
    assert len(requests) == 1
    assert requests[0]["StartTime"] == start_time
    assert requests[0]["InstanceTypes"] == ["p5.48xlarge"]
    assert requests[0]["ProductDescriptions"] == ["Linux/UNIX"]
    if include_end_time:
        assert requests[0]["EndTime"] == end_time
    else:
        assert "EndTime" not in requests[0]


async def test_scheduled_collector_behavior_remains_current_price_only(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Scheduled collection keeps latest-per-instance/AZ and run-time stamping."""
    collected_at = datetime.datetime(2026, 7, 29, 12, tzinfo=datetime.UTC)
    older = _record(datetime.datetime(2026, 7, 29, 10, tzinfo=datetime.UTC))
    latest = _record(datetime.datetime(2026, 7, 29, 11, tzinfo=datetime.UTC))
    requested: list[tuple[datetime.datetime, datetime.datetime | None]] = []

    class FakeSession:
        @staticmethod
        def get_credentials() -> object:
            return object()

    async def fake_fetch(
        start_time: datetime.datetime,
        end_time: datetime.datetime | None = None,
        **_: Any,
    ) -> list[dict[str, Any]]:
        requested.append((start_time, end_time))
        return [older, latest]

    monkeypatch.setattr(aws_spot.boto3, "Session", FakeSession)
    monkeypatch.setattr(aws_spot, "fetch_spot_history", fake_fetch)
    monkeypatch.setattr(
        AWSSpotCollector,
        "now_utc",
        staticmethod(lambda: collected_at),
    )

    observations = await AWSSpotCollector().collect()

    assert requested == [(collected_at - datetime.timedelta(hours=24), None)]
    assert len(observations) == 1
    assert observations[0].collected_at == collected_at
    assert observations[0].raw_payload["Timestamp"] == latest["Timestamp"].isoformat()
    assert observations[0].price_hourly == pytest.approx(3.20)
    assert "backfill" not in observations[0].provider_metadata


def test_backfill_uses_record_timestamp_and_provenance_metadata() -> None:
    """Historical records retain their own UTC date and per-GPU conversion."""
    executed_at = datetime.datetime(2026, 7, 29, 18, 30, tzinfo=datetime.UTC)
    observed_at = datetime.datetime(
        2026,
        5,
        1,
        12,
        tzinfo=datetime.timezone(datetime.timedelta(hours=-4)),
    )
    record = _record(observed_at)

    batch = run_backfill_aws.build_backfill_batch(
        [record],
        executed_at=executed_at,
        existing_keys=set(),
    )

    assert len(batch.observations) == 1
    observation = batch.observations[0]
    assert observation.collected_at == datetime.datetime(2026, 5, 1, 16, tzinfo=datetime.UTC)
    assert observation.price_hourly == pytest.approx(3.20)
    assert observation.provider_metadata["backfill"] is True
    assert observation.provider_metadata["backfill_executed_at"] == ("2026-07-29T18:30:00+00:00")
    assert observation.raw_payload == {
        **record,
        "Timestamp": observed_at.isoformat(),
    }


def test_backfill_deduplicates_existing_and_batch_keys() -> None:
    """Existing and repeated response keys are skipped before insert."""
    timestamp = datetime.datetime(2026, 5, 1, 12, tzinfo=datetime.UTC)
    existing_record = _record(timestamp)
    new_record = _record(timestamp, availability_zone="us-east-1b")
    existing_key = run_backfill_aws.spot_key_from_record(existing_record)
    assert existing_key is not None

    batch = run_backfill_aws.build_backfill_batch(
        [existing_record, new_record, new_record],
        executed_at=datetime.datetime(2026, 7, 29, tzinfo=datetime.UTC),
        existing_keys={existing_key},
    )

    assert len(batch.observations) == 1
    assert batch.duplicate_existing == 1
    assert batch.duplicate_batch == 1
    assert batch.invalid_key == 0
    assert batch.unparseable == 0


def test_existing_key_prefers_metadata_but_timestamp_always_uses_raw() -> None:
    """Cron-era raws can be keyed without substituting collected_at."""
    key = run_backfill_aws.spot_key_from_existing(
        {
            "instance_type": "p5.48xlarge",
            "availability_zone": "us-east-1a",
        },
        {
            "InstanceType": "ignored.raw.type",
            "AvailabilityZone": "ignored-raw-zone",
            "Timestamp": "2026-05-01T12:00:00Z",
        },
    )
    fallback_key = run_backfill_aws.spot_key_from_existing(
        {},
        {
            "InstanceType": "p4d.24xlarge",
            "AvailabilityZone": "us-west-2a",
            "Timestamp": "2026-05-02T12:00:00+00:00",
        },
    )

    assert key == (
        "p5.48xlarge",
        "us-east-1a",
        datetime.datetime(2026, 5, 1, 12, tzinfo=datetime.UTC),
    )
    assert fallback_key == (
        "p4d.24xlarge",
        "us-west-2a",
        datetime.datetime(2026, 5, 2, 12, tzinfo=datetime.UTC),
    )


def test_backfill_skips_unmapped_instance_type() -> None:
    """ADR-0002 forbids guessing a GPU mapping for an unknown VM size."""
    record = _record(
        "2026-05-01T12:00:00Z",
        instance_type="p99.unknown",
    )

    batch = run_backfill_aws.build_backfill_batch(
        [record],
        executed_at=datetime.datetime(2026, 7, 29, tzinfo=datetime.UTC),
        existing_keys=set(),
    )

    assert batch.observations == []
    assert batch.unparseable == 1
