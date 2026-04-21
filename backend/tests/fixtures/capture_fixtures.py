"""Capture live provider responses for use as test fixtures.

This script is a one-time manual step. It calls each collector's underlying
`_fetch_*` method, writes the JSON response to a fixture file, and commits
the result for the parse tests in `test_collectors.py`.

Fixture freshness matters: run this when provider APIs are healthy, so the
saved responses represent a typical live shape. Do NOT re-run casually —
fixtures are frozen snapshots; changing them defeats their purpose.

Usage (from repo root):
    uv run python backend/tests/fixtures/capture_fixtures.py
    uv run python backend/tests/fixtures/capture_fixtures.py --skip-aws   # if no creds

What gets written:
    backend/tests/fixtures/vast_sample.json          (list of offer dicts)
    backend/tests/fixtures/runpod_sample.json        (list of gpuType dicts)
    backend/tests/fixtures/tensordock_sample.json    (list of location dicts)
    backend/tests/fixtures/aws_spot_sample.json      (list of spot records; us-east-1 only)

After capture:
    uv run pytest backend/tests/test_collectors.py -v
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("capture")

FIXTURES_DIR = Path(__file__).parent


def _write(name: str, data: object) -> None:
    path = FIXTURES_DIR / name
    path.write_text(json.dumps(data, indent=2, default=str))
    count = len(data) if isinstance(data, list) else "n/a"
    logger.info("wrote %s (%s items)", path.relative_to(FIXTURES_DIR.parents[2]), count)


async def capture_vast() -> None:
    from basis.collectors.vast import VastCollector

    offers = await VastCollector()._fetch_offers()
    _write("vast_sample.json", offers)


async def capture_runpod() -> None:
    from basis.collectors.runpod import RunPodCollector

    gpu_types = await RunPodCollector()._fetch_gpu_types()
    _write("runpod_sample.json", gpu_types)


async def capture_tensordock() -> None:
    from basis.collectors.tensordock import TensorDockCollector

    locations = await TensorDockCollector()._fetch_locations()
    _write("tensordock_sample.json", locations)


def capture_aws_spot() -> None:
    """AWS Spot capture is synchronous and needs creds. One region only."""
    from datetime import timedelta

    from basis.collectors.aws_spot import AWSSpotCollector, GPU_INSTANCE_TYPES
    from basis.config import settings

    if not settings.aws_access_key_id or not settings.aws_secret_access_key:
        logger.warning("AWS creds missing; skipping AWS Spot capture")
        return

    collector = AWSSpotCollector()
    now = collector.now_utc()
    start_time = now - timedelta(hours=24)
    instance_types = [it for it, _, _, _ in GPU_INSTANCE_TYPES]

    # Inline the fetch portion of _fetch_region_sync without the dedup, so we
    # preserve as much raw signal as possible for the parse test.
    import boto3
    from botocore.config import Config as BotoConfig

    region = "us-east-1"
    client = boto3.client(
        "ec2",
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        config=BotoConfig(region_name=region, retries={"max_attempts": 2}),
    )
    paginator = client.get_paginator("describe_spot_price_history")
    records: list[dict] = []
    for page in paginator.paginate(
        InstanceTypes=instance_types,
        ProductDescriptions=["Linux/UNIX"],
        StartTime=start_time,
    ):
        records.extend(page.get("SpotPriceHistory", []))

    _write("aws_spot_sample.json", records)


async def _main(skip_aws: bool) -> None:
    logger.info("Capturing provider fixtures into %s", FIXTURES_DIR)
    await capture_vast()
    await capture_runpod()
    await capture_tensordock()
    if not skip_aws:
        capture_aws_spot()
    else:
        logger.info("Skipping AWS Spot capture (--skip-aws)")


if __name__ == "__main__":
    # Repo root on sys.path so `basis.*` imports resolve when running from the
    # fixtures directory.
    _REPO_ROOT = Path(__file__).resolve().parents[3]
    _BACKEND = _REPO_ROOT / "backend"
    if str(_BACKEND) not in sys.path:
        sys.path.insert(0, str(_BACKEND))

    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--skip-aws",
        action="store_true",
        help="Skip AWS Spot capture (use when AWS creds aren't configured).",
    )
    args = parser.parse_args()
    asyncio.run(_main(args.skip_aws))
