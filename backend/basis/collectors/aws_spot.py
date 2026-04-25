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
from datetime import timedelta
from functools import partial

import boto3
from botocore.config import Config as BotoConfig

from basis.collectors.base import BaseCollector
from basis.config import settings
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
    itype: (count, model, vram)
    for itype, count, model, vram in GPU_INSTANCE_TYPES
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
            logger.warning("AWS credentials not findable (env, IAM role, or profile) — skipping AWS Spot")
            return []

        now = self.now_utc()
        start_time = now - timedelta(hours=24)
        instance_types = [it for it, _, _, _ in GPU_INSTANCE_TYPES]

        # Fetch all regions concurrently
        tasks = [
            self._fetch_region(region, instance_types, start_time, now)
            for region in AWS_REGIONS
        ]
        region_results = await asyncio.gather(*tasks, return_exceptions=True)

        observations: list[RawObservationCreate] = []
        for region, result in zip(AWS_REGIONS, region_results):
            if isinstance(result, Exception):
                logger.warning("Failed to fetch AWS Spot for region %s: %s", region, result)
                continue
            observations.extend(result)

        return observations

    async def _fetch_region(
        self,
        region: str,
        instance_types: list[str],
        start_time,
        collected_at,
    ) -> list[RawObservationCreate]:
        """Fetch spot price history for one region.

        boto3 is synchronous, so we run it in a thread executor.
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            partial(
                self._fetch_region_sync, region, instance_types, start_time, collected_at
            ),
        )

    def _fetch_region_sync(
        self,
        region: str,
        instance_types: list[str],
        start_time,
        collected_at,
    ) -> list[RawObservationCreate]:
        """Synchronous boto3 call for one region."""
        boto_config = BotoConfig(
            region_name=region,
            retries={"max_attempts": 2, "mode": "standard"},
        )
        # boto3 picks up credentials from env vars (local) or IAM role (EC2)
        client = boto3.client("ec2", config=boto_config)

        # Paginate through results
        all_records: list[dict] = []
        paginator = client.get_paginator("describe_spot_price_history")
        pages = paginator.paginate(
            InstanceTypes=instance_types,
            ProductDescriptions=["Linux/UNIX"],
            StartTime=start_time,
        )

        for page in pages:
            all_records.extend(page.get("SpotPriceHistory", []))

        logger.info("AWS Spot %s: %d price records", region, len(all_records))

        # Keep only the most recent price per (instance_type, AZ)
        latest: dict[tuple[str, str], dict] = {}
        for record in all_records:
            key = (record["InstanceType"], record["AvailabilityZone"])
            existing = latest.get(key)
            if existing is None or record["Timestamp"] > existing["Timestamp"]:
                latest[key] = record

        observations: list[RawObservationCreate] = []
        for record in latest.values():
            obs = self._parse_record(record, collected_at)
            if obs is not None:
                observations.append(obs)

        return observations

    @staticmethod
    def _parse_record(record: dict, collected_at) -> RawObservationCreate | None:
        """Convert an AWS spot price record to a RawObservationCreate."""
        instance_type = record.get("InstanceType", "")
        spot_price_str = record.get("SpotPrice", "0")
        az = record.get("AvailabilityZone", "")

        gpu_info = _INSTANCE_MAP.get(instance_type)
        if gpu_info is None:
            return None

        gpu_count, gpu_model, vram_gb = gpu_info

        try:
            instance_price = float(spot_price_str)
        except (ValueError, TypeError):
            return None

        if instance_price <= 0:
            return None

        price_per_gpu = instance_price / gpu_count

        # Make the record JSON-serializable (Timestamp is a datetime object)
        serializable_record = {
            **record,
            "Timestamp": record["Timestamp"].isoformat() if hasattr(record.get("Timestamp", ""), "isoformat") else str(record.get("Timestamp", "")),
        }

        return RawObservationCreate(
            source="aws_spot",
            collected_at=collected_at,
            raw_payload=serializable_record,
            gpu_model_reported=gpu_model,
            price_hourly=price_per_gpu,
            region_reported=az,
            commitment_type_reported="spot",
            provider_metadata={
                "instance_type": instance_type,
                "instance_price_hourly": instance_price,
                "gpu_count": gpu_count,
                "vram_gb": vram_gb,
                "availability_zone": az,
                "region": az[:-1],  # us-east-1a -> us-east-1
            },
        )
