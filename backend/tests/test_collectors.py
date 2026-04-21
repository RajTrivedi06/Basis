"""Collector parse tests, fixture-driven.

Catches silent provider API shape changes. When a provider's response shape
shifts (e.g., TensorDock's `gpus` field changed dict -> list once during
build), these tests fail loudly instead of the collector silently producing
zero observations.

Fixtures are captured manually via `backend/tests/fixtures/capture_fixtures.py`.
If the fixture file is missing, the corresponding test skips — on a fresh
clone you haven't captured yet, or in CI without live provider access, this
is the right behavior.

Each test asserts:
- The parse function produces RawObservationCreate objects.
- A minimum number of observations (sanity check: fixture isn't one row).
- Required fields are populated on every observation.
- `raw_payload` is a dict and JSON round-trips cleanly.
"""

from __future__ import annotations

import datetime
import json
from pathlib import Path

import pytest

from basis.collectors.aws_spot import AWSSpotCollector
from basis.collectors.runpod import RunPodCollector
from basis.collectors.tensordock import TensorDockCollector
from basis.collectors.vast import VastCollector
from basis.schemas.raw import RawObservationCreate

FIXTURES_DIR = Path(__file__).parent / "fixtures"

# Minimum observation count per collector. Tuned low enough that a typical
# capture comfortably clears it but high enough that a near-empty (broken)
# fetch fails. AWS is lower because one-region captures yield far fewer rows.
_MIN_OBS = {
    "vast": 50,
    "runpod": 10,
    "tensordock": 10,
    "aws_spot": 5,
}


def _load_fixture(name: str) -> list[dict]:
    """Load a fixture file, or skip the test if it doesn't exist."""
    path = FIXTURES_DIR / name
    if not path.exists():
        pytest.skip(
            f"Fixture {path.name} not found. Run "
            f"`uv run python backend/tests/fixtures/capture_fixtures.py` to capture."
        )
    return json.loads(path.read_text())


def _assert_valid_observations(
    observations: list[RawObservationCreate], expected_source: str, min_count: int
) -> None:
    """Shared assertions for any collector's parsed observations."""
    assert len(observations) >= min_count, (
        f"{expected_source}: parsed {len(observations)} observations, "
        f"expected >= {min_count}. Provider API shape may have changed."
    )
    for i, obs in enumerate(observations):
        assert isinstance(obs, RawObservationCreate), (
            f"{expected_source}[{i}]: not a RawObservationCreate"
        )
        assert obs.source == expected_source, (
            f"{expected_source}[{i}]: wrong source={obs.source!r}"
        )
        assert obs.gpu_model_reported, f"{expected_source}[{i}]: empty gpu_model_reported"
        assert obs.price_hourly > 0, (
            f"{expected_source}[{i}]: non-positive price_hourly={obs.price_hourly}"
        )
        assert isinstance(obs.raw_payload, dict), (
            f"{expected_source}[{i}]: raw_payload is {type(obs.raw_payload).__name__}, "
            f"not dict"
        )
        # JSON round-trip: raw_payload must be serializable for JSONB storage.
        json.dumps(obs.raw_payload, default=str)


def test_vast_collector_parses_fixture() -> None:
    """VastCollector parses a saved Vast.ai response into valid observations."""
    offers = _load_fixture("vast_sample.json")
    now = datetime.datetime.now(datetime.UTC)
    observations: list[RawObservationCreate] = []
    for offer in offers:
        obs = VastCollector._parse_offer(offer, now)
        if obs is not None:
            observations.append(obs)
    _assert_valid_observations(observations, "vast", _MIN_OBS["vast"])


def test_runpod_collector_parses_fixture() -> None:
    """RunPodCollector parses a saved GraphQL response into valid observations."""
    gpu_types = _load_fixture("runpod_sample.json")
    now = datetime.datetime.now(datetime.UTC)
    observations: list[RawObservationCreate] = []
    for gpu in gpu_types:
        observations.extend(RunPodCollector._parse_gpu_type(gpu, now))
    _assert_valid_observations(observations, "runpod", _MIN_OBS["runpod"])


def test_tensordock_collector_parses_fixture() -> None:
    """TensorDockCollector parses a saved locations response into valid observations."""
    locations = _load_fixture("tensordock_sample.json")
    now = datetime.datetime.now(datetime.UTC)
    observations: list[RawObservationCreate] = []
    for location in locations:
        observations.extend(TensorDockCollector._parse_location(location, now))
    _assert_valid_observations(observations, "tensordock", _MIN_OBS["tensordock"])


def test_aws_spot_collector_parses_fixture() -> None:
    """AWSSpotCollector parses a saved spot-history response into valid observations."""
    records = _load_fixture("aws_spot_sample.json")
    now = datetime.datetime.now(datetime.UTC)
    observations: list[RawObservationCreate] = []
    for record in records:
        obs = AWSSpotCollector._parse_record(record, now)
        if obs is not None:
            observations.append(obs)
    _assert_valid_observations(observations, "aws_spot", _MIN_OBS["aws_spot"])


def test_aws_spot_per_gpu_price_conversion() -> None:
    """AWS instance prices are divided by GPU count per _INSTANCE_MAP.

    p5.48xlarge has 8x H100 SXM; a $25.60/hr instance price should yield
    $3.20/hr per GPU. This test uses a synthetic record so it runs even
    without a fixture file.
    """
    record = {
        "InstanceType": "p5.48xlarge",
        "SpotPrice": "25.60",
        "AvailabilityZone": "us-east-1a",
        "ProductDescription": "Linux/UNIX",
        "Timestamp": "2026-04-20T12:00:00Z",
    }
    obs = AWSSpotCollector._parse_record(record, datetime.datetime.now(datetime.UTC))
    assert obs is not None
    assert obs.price_hourly == pytest.approx(3.20)
    assert obs.gpu_model_reported == "H100 SXM"
    assert obs.region_reported == "us-east-1a"
