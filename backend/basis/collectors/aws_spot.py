"""AWS EC2 Spot Price History collector.

Data source: boto3 ec2.describe_spot_price_history()
Auth: Free AWS account with ec2:DescribeSpotPriceHistory permission
Format: Spot price records with instance type, availability zone, and timestamp

AWS prices are per-instance, not per-GPU. Each instance type bundles a fixed
number of GPUs, so we divide the instance price by GPU count to get $/GPU/hour.

Instance type -> GPU mapping:
  p5.48xlarge   = 8x H100 SXM (80GB)
  p5e.48xlarge  = 8x H200 SXM (141GB)
  p4d.24xlarge  = 8x A100 SXM (40GB)
  p4de.24xlarge = 8x A100 SXM (80GB)
  g5.xlarge     = 1x A10G (24GB)     ... through g5.48xlarge = 8x A10G
  g6.xlarge     = 1x L4 (24GB)       ... through g6.48xlarge = 8x L4

See docs/data_sources.md for full documentation.
"""

import asyncio
import logging
from collections.abc import Sequence
from datetime import datetime, timedelta
from functools import partial
from typing import Any

import boto3
from botocore.config import Config as BotoConfig

from basis.collectors.base import BaseCollector
from basis.schemas.raw import RawObservationCreate

logger = logging.getLogger(__name__)

# Instance types to track and their GPU details.
# (instance_type, gpu_count, gpu_model_name, vram_gb)
GPU_INSTANCE_TYPES: list[tuple[str, int, str, int]] = [
    ("p5.48xlarge", 8, "H100 SXM", 80),
    ("p5e.48xlarge", 8, "H200 SXM", 141),
    ("p4d.24xlarge", 8, "A100 SXM 40GB", 40),
    ("p4de.24xlarge", 8, "A100 SXM 80GB", 80),
    ("g5.xlarge", 1, "A10G", 24),
    ("g5.2xlarge", 1, "A10G", 24),
    ("g5.4xlarge", 1, "A10G", 24),
    ("g5.8xlarge", 1, "A10G", 24),
    ("g5.12xlarge", 4, "A10G", 24),
    ("g5.24xlarge", 4, "A10G", 24),
    ("g5.48xlarge", 8, "A10G", 24),
    ("g6.xlarge", 1, "L4", 24),
    ("g6.2xlarge", 1, "L4", 24),
    ("g6.4xlarge", 1, "L4", 24),
    ("g6.8xlarge", 1, "L4", 24),
    ("g6.12xlarge", 4, "L4", 24),
    ("g6.24xlarge", 4, "L4", 24),
    ("g6.48xlarge", 8, "L4", 24),
]

# Build a lookup from instance type to (gpu_count, gpu_model, vram_gb)
_INSTANCE_MAP: dict[str, tuple[int, str, int]] = {
    itype: (count, model, vram) for itype, count, model, vram in GPU_INSTANCE_TYPES
}

# AWS regions with significant GPU spot availability
AWS_REGIONS = [
    "us-east-1",
    "us-east-2",
    "us-west-2",
    "eu-west-1",
    "eu-central-1",
    "ap-northeast-1",
    "ap-southeast-1",
]


async def fetch_spot_history(
    start_time: datetime,
    end_time: datetime | None = None,
    *,
    regions: Sequence[str] = AWS_REGIONS,
    instance_types: Sequence[str] | None = None,
) -> list[dict[str, Any]]:
    """Fetch all paginated Spot Price History records across AWS regions.

    Region failures are logged and skipped so a partial AWS outage does not
    discard successful responses from other regions.
    """
    requested_types = (
        list(instance_types)
        if instance_types is not None
        else [instance_type for instance_type, _, _, _ in GPU_INSTANCE_TYPES]
    )
    tasks = [
        _fetch_region_spot_history(region, requested_types, start_time, end_time)
        for region in regions
    ]
    region_results = await asyncio.gather(*tasks, return_exceptions=True)

    records: list[dict[str, Any]] = []
    for region, result in zip(regions, region_results, strict=True):
        if isinstance(result, BaseException):
            logger.warning("Failed to fetch AWS Spot for region %s: %s", region, result)
            continue
        records.extend(result)
    return records


async def _fetch_region_spot_history(
    region: str,
    instance_types: list[str],
    start_time: datetime,
    end_time: datetime | None,
) -> list[dict[str, Any]]:
    """Run the synchronous boto3 history request in a thread executor."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None,
        partial(
            _fetch_region_spot_history_sync,
            region,
            instance_types,
            start_time,
            end_time,
        ),
    )


def _fetch_region_spot_history_sync(
    region: str,
    instance_types: list[str],
    start_time: datetime,
    end_time: datetime | None,
) -> list[dict[str, Any]]:
    """Fetch every paginator page for one AWS region."""
    boto_config = BotoConfig(
        region_name=region,
        retries={"max_attempts": 2, "mode": "standard"},
    )
    # boto3 picks up credentials from env vars (local) or IAM role (EC2)
    client = boto3.client("ec2", config=boto_config)
    paginator = client.get_paginator("describe_spot_price_history")
    request: dict[str, Any] = {
        "InstanceTypes": instance_types,
        "ProductDescriptions": ["Linux/UNIX"],
        "StartTime": start_time,
    }
    if end_time is not None:
        request["EndTime"] = end_time

    records: list[dict[str, Any]] = []
    for page in paginator.paginate(**request):
        records.extend(page.get("SpotPriceHistory", []))

    logger.info("AWS Spot %s: %d price records", region, len(records))
    return records


def latest_spot_records(
    records: Sequence[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Keep the most recent record per (instance type, availability zone)."""
    latest: dict[tuple[str, str], dict[str, Any]] = {}
    for record in records:
        key = (record["InstanceType"], record["AvailabilityZone"])
        existing = latest.get(key)
        if existing is None or record["Timestamp"] > existing["Timestamp"]:
            latest[key] = record
    return list(latest.values())


def parse_spot_record(
    record: dict[str, Any],
    collected_at: datetime,
    *,
    provider_metadata_extra: dict[str, Any] | None = None,
) -> RawObservationCreate | None:
    """Convert a full AWS spot price record to a raw observation."""
    instance_type = record.get("InstanceType", "")
    spot_price_str = record.get("SpotPrice", "0")
    az = record.get("AvailabilityZone", "")

    gpu_info = _INSTANCE_MAP.get(instance_type)
    if gpu_info is None:
        logger.warning("Skipping unmapped AWS Spot instance type %r", instance_type)
        return None

    gpu_count, gpu_model, vram_gb = gpu_info

    try:
        instance_price = float(spot_price_str)
    except (ValueError, TypeError):
        logger.warning(
            "Skipping AWS Spot record with invalid price %r for %s",
            spot_price_str,
            instance_type,
        )
        return None

    if instance_price <= 0:
        logger.warning(
            "Skipping AWS Spot record with non-positive price %r for %s",
            spot_price_str,
            instance_type,
        )
        return None

    price_per_gpu = instance_price / gpu_count

    # Preserve every provider field, changing only datetime serialization so
    # the full response can be stored as JSONB.
    serializable_record = {
        **record,
        "Timestamp": (
            record["Timestamp"].isoformat()
            if hasattr(record.get("Timestamp", ""), "isoformat")
            else str(record.get("Timestamp", ""))
        ),
    }
    provider_metadata = {
        "instance_type": instance_type,
        "instance_price_hourly": instance_price,
        "gpu_count": gpu_count,
        "vram_gb": vram_gb,
        "availability_zone": az,
        "region": az[:-1],  # us-east-1a -> us-east-1
    }
    if provider_metadata_extra:
        provider_metadata.update(provider_metadata_extra)

    return RawObservationCreate(
        source="aws_spot",
        collected_at=collected_at,
        raw_payload=serializable_record,
        gpu_model_reported=gpu_model,
        price_hourly=price_per_gpu,
        region_reported=az,
        commitment_type_reported="spot",
        provider_metadata=provider_metadata,
    )


class AWSSpotCollector(BaseCollector):
    """Collects GPU spot pricing from AWS EC2 Spot Price History.

    Queries the last 24 hours of spot price changes for GPU instance types
    across major regions. Only the most recent price per (instance_type, AZ)
    combination is kept to avoid duplicating stable prices.
    """

    source_name = "aws_spot"

    async def collect(self) -> list[RawObservationCreate]:
        """Fetch spot prices across all regions and GPU instance types."""
        if boto3.Session().get_credentials() is None:
            logger.warning(
                "AWS credentials not findable (env, IAM role, or profile) — skipping AWS Spot"
            )
            return []

        now = self.now_utc()
        start_time = now - timedelta(hours=24)
        records = await fetch_spot_history(start_time)
        observations: list[RawObservationCreate] = []
        for record in latest_spot_records(records):
            observation = parse_spot_record(record, now)
            if observation is not None:
                observations.append(observation)
        return observations

    @staticmethod
    def _parse_record(
        record: dict[str, Any], collected_at: datetime
    ) -> RawObservationCreate | None:
        """Compatibility wrapper around the shared AWS record parser."""
        return parse_spot_record(record, collected_at)
