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

import httpx
import pytest

from basis.collectors.aws_spot import AWSSpotCollector
from basis.collectors.azure import AzureCollector
from basis.collectors.gcp import (
    GPU_DESCRIPTION_MAP,
    GCPCollector,
    classify_commitment,
    match_gpu_model,
    unit_price_to_usd,
)
from basis.collectors.runpod import RunPodCollector
from basis.collectors.tensordock import TensorDockCollector
from basis.collectors.vast import VastCollector, _request_with_retry
from basis.normalization.region import normalize_region
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
    "azure": 5,
    "gcp": 10,
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


def test_azure_collector_parses_committed_fixture() -> None:
    """AzureCollector parses a trimmed real Retail Prices response page."""
    page = json.loads((FIXTURES_DIR / "azure_sample.json").read_text())
    now = datetime.datetime.now(datetime.UTC)
    observations: list[RawObservationCreate] = []
    for item in page["Items"]:
        obs = AzureCollector._parse_item(item, now)
        if obs is not None:
            observations.append(obs)

    _assert_valid_observations(observations, "azure", _MIN_OBS["azure"])
    assert len(observations) == 7
    assert all(obs.raw_payload in page["Items"] for obs in observations)


def _azure_item(
    *,
    arm_sku_name: str = "Standard_ND96isr_H100_v5",
    retail_price: float = 32.0,
    price_type: str = "Consumption",
    sku_name: str = "ND96isrH100v5",
    meter_name: str = "ND96isrH100v5",
    reservation_term: str | None = None,
) -> dict:
    return {
        "currencyCode": "USD",
        "retailPrice": retail_price,
        "unitPrice": retail_price,
        "armRegionName": "eastus",
        "meterId": "test-meter",
        "meterName": meter_name,
        "productName": "Virtual Machines GPU Series",
        "skuName": sku_name,
        "serviceName": "Virtual Machines",
        "unitOfMeasure": "1 Hour",
        "type": price_type,
        "armSkuName": arm_sku_name,
        **(
            {"reservationTerm": reservation_term}
            if reservation_term is not None
            else {}
        ),
    }


def test_azure_per_instance_to_per_gpu_price_conversion() -> None:
    """An 8x H100 VM's hourly instance price is divided by eight."""
    item = _azure_item(retail_price=32.0)
    obs = AzureCollector._parse_item(item, datetime.datetime.now(datetime.UTC))

    assert obs is not None
    assert obs.price_hourly == pytest.approx(4.0)
    assert obs.gpu_model_reported == "H100 SXM"
    assert obs.provider_metadata["gpu_count"] == 8
    assert obs.provider_metadata["price_conversion"]["formula"] == (
        "retailPrice / gpu_count"
    )
    assert obs.raw_payload == item


@pytest.mark.parametrize(
    ("sku_name", "meter_name", "expected_commitment"),
    [
        ("ND96isrH100v5", "ND96isrH100v5", "on_demand"),
        ("ND96isrH100v5 Spot", "ND96isrH100v5 Spot", "spot"),
    ],
)
def test_azure_consumption_commitment_classification(
    sku_name: str, meter_name: str, expected_commitment: str
) -> None:
    item = _azure_item(sku_name=sku_name, meter_name=meter_name)
    obs = AzureCollector._parse_item(item, datetime.datetime.now(datetime.UTC))

    assert obs is not None
    assert obs.commitment_type_reported == expected_commitment


@pytest.mark.parametrize(
    ("term", "term_hours", "commitment"),
    [
        ("1 Year", 365 * 24, "reserved_1y"),
        ("3 Years", 3 * 365 * 24, "reserved_3y"),
    ],
)
def test_azure_reservation_total_converted_to_effective_gpu_hour(
    term: str, term_hours: int, commitment: str
) -> None:
    # Choose an upfront total that converts to exactly $2/GPU/hour for 8 GPUs.
    upfront_total = 2.0 * 8 * term_hours
    item = _azure_item(
        retail_price=upfront_total,
        price_type="Reservation",
        reservation_term=term,
    )
    obs = AzureCollector._parse_item(item, datetime.datetime.now(datetime.UTC))

    assert obs is not None
    assert obs.commitment_type_reported == commitment
    assert obs.price_hourly == pytest.approx(2.0)
    conversion = obs.provider_metadata["price_conversion"]
    assert conversion["source_price_basis"] == "USD upfront total"
    assert conversion["term_hours"] == term_hours
    assert conversion["formula"] == "retailPrice / term_hours / gpu_count"


def test_azure_low_priority_is_skipped() -> None:
    item = _azure_item(
        sku_name="ND96isrH100v5 Low Priority",
        meter_name="ND96isrH100v5 Low Priority",
    )
    assert (
        AzureCollector._parse_item(item, datetime.datetime.now(datetime.UTC))
        is None
    )


def test_azure_unmapped_sku_is_skipped() -> None:
    item = _azure_item(arm_sku_name="Standard_NC999_Unknown_v1")
    assert (
        AzureCollector._parse_item(item, datetime.datetime.now(datetime.UTC))
        is None
    )


async def test_azure_retry_succeeds_after_transient_429s() -> None:
    """Azure requests use the same bounded transient-failure retry pattern."""
    from basis.collectors.azure import _request_with_retry as azure_request

    attempts = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        attempts["n"] += 1
        if attempts["n"] < 3:
            return httpx.Response(429, json={"error": "rate limited"})
        return httpx.Response(200, json={"Items": [], "NextPageLink": None})

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler)
    ) as client:
        response = await azure_request(
            client, "https://example.invalid/", backoffs=(0.0, 0.0, 0.0)
        )

    assert response.status_code == 200
    assert attempts["n"] == 3


async def test_azure_collect_follows_next_page_link() -> None:
    """A non-null NextPageLink is fetched and its items are retained."""
    import unittest.mock

    from basis.collectors import azure as azure_module

    first_item = _azure_item(retail_price=32.0)
    second_item = _azure_item(
        retail_price=24.0,
        sku_name="ND96isrH100v5 Spot",
        meter_name="ND96isrH100v5 Spot",
    )
    requested_urls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requested_urls.append(str(request.url))
        if request.url.params.get("$skip") == "1":
            return httpx.Response(
                200,
                json={"Items": [second_item], "NextPageLink": None},
            )
        return httpx.Response(
            200,
            json={
                "Items": [first_item],
                "NextPageLink": (
                    "https://prices.azure.com/api/retail/prices?$skip=1"
                ),
            },
        )

    transport = httpx.MockTransport(handler)
    real_client_cls = azure_module.httpx.AsyncClient

    def make_client(*args: object, **kwargs: object) -> httpx.AsyncClient:
        return real_client_cls(transport=transport)

    with unittest.mock.patch.object(
        azure_module.httpx, "AsyncClient", make_client
    ):
        observations = await AzureCollector().collect()

    assert len(observations) == 2
    assert [obs.commitment_type_reported for obs in observations] == [
        "on_demand",
        "spot",
    ]
    assert len(requested_urls) == 2
    assert "$skip=1" in requested_urls[1]
def test_gcp_collector_parses_fixture() -> None:
    """GCPCollector parses a saved Cloud Billing SKU page into valid observations."""
    skus = _load_fixture("gcp_sample.json")
    now = datetime.datetime.now(datetime.UTC)
    observations: list[RawObservationCreate] = []
    for sku in skus:
        obs, _ = GCPCollector._parse_sku(sku, now)
        if obs is not None:
            observations.append(obs)
    _assert_valid_observations(observations, "gcp", _MIN_OBS["gcp"])


def test_gcp_unit_price_nanos_conversion() -> None:
    """GCP Money units+nanos must convert to USD float correctly."""
    assert unit_price_to_usd(0, 350000000) == pytest.approx(0.35)
    assert unit_price_to_usd(2, 48000000) == pytest.approx(2.048)


def test_gcp_gpu_description_map() -> None:
    """GPU model map uses ordered exact-substring rules."""
    assert match_gpu_model("Nvidia H100 80GB GPU running in us-central1") == "H100 80GB"
    assert match_gpu_model("Nvidia Tesla A100 80GB GPU running in Americas") == "A100 80GB"
    assert match_gpu_model("Nvidia Tesla A100 GPU running in Americas") == "A100"
    assert match_gpu_model("Nvidia L4 GPU running in us-west1") == "L4"
    assert match_gpu_model("Nvidia Tesla T4 GPU attached to VMs") == "T4"
    assert match_gpu_model("Nvidia Tesla V100 GPU running in europe-west3") == "V100"
    assert match_gpu_model("Nvidia Tesla P100 GPU running in us-east1") == "P100"
    assert match_gpu_model("Nvidia RTX 4090 GPU running in us-central1") is None
    needles = [needle for needle, _ in GPU_DESCRIPTION_MAP]
    assert needles.index("H100 80GB") < needles.index("A100")
    assert needles.index("A100 80GB") < needles.index("A100")


@pytest.mark.parametrize(
    ("description", "expected"),
    [
        (
            "Nvidia Tesla A100 80GB GPU attached to Spot Preemptible VMs running in Americas",
            "spot",
        ),
        (
            "Nvidia Tesla T4 GPU attached to VMs running in asia-southeast1",
            "on_demand",
        ),
        (
            "Nvidia Tesla A100 80GB GPU running in Columbus",
            "on_demand",
        ),
        (
            "Commitment v1: Nvidia Tesla A100 80GB GPU running in us-central1 for 1 Year",
            "reserved_1y",
        ),
        (
            "Commitment v1: Nvidia H100 80GB GPU running in us-west4 for 3 Year",
            "reserved_3y",
        ),
        ("Nvidia Tesla A100 GPU with unknown billing shape", None),
    ],
)
def test_gcp_commitment_classification(description: str, expected: str | None) -> None:
    assert classify_commitment(description) == expected


def test_gcp_multi_region_normalizes_to_empty_country() -> None:
    """Multi-region strings like 'Americas' stay in region_reported but map to None."""
    result = normalize_region("gcp", "Americas")
    assert result.country is None
    assert result.state is None

    concrete = normalize_region("gcp", "us-central1")
    assert concrete.country == "US"
    assert concrete.state == "Iowa"


async def test_gcp_collect_returns_empty_when_no_api_key(monkeypatch, caplog) -> None:
    """Without GCP_API_KEY the collector warns and returns []."""
    import logging

    from basis.collectors import gcp as gcp_module

    monkeypatch.setattr(gcp_module.settings, "gcp_api_key", "")

    with caplog.at_level(logging.WARNING):
        observations = await GCPCollector().collect()

    assert observations == []
    assert any("GCP API key not configured" in record.message for record in caplog.records)


async def test_vast_retry_succeeds_after_transient_429s() -> None:
    """Two 429s followed by a 200 should succeed on the third attempt."""
    attempts = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        attempts["n"] += 1
        if attempts["n"] < 3:
            return httpx.Response(429, json={"error": "rate limited"})
        return httpx.Response(200, json={"offers": []})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        response = await _request_with_retry(
            client, "https://example.invalid/", backoffs=(0.0, 0.0, 0.0)
        )

    assert response.status_code == 200
    assert attempts["n"] == 3


async def test_vast_retry_raises_after_exhausting_attempts() -> None:
    """Three consecutive 429s should raise HTTPStatusError (no further retries)."""
    attempts = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        attempts["n"] += 1
        return httpx.Response(429, json={"error": "rate limited"})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        with pytest.raises(httpx.HTTPStatusError) as excinfo:
            await _request_with_retry(
                client, "https://example.invalid/", backoffs=(0.0, 0.0, 0.0)
            )

    assert excinfo.value.response.status_code == 429
    assert attempts["n"] == 3


async def test_vast_collect_returns_partial_when_bid_endpoint_fails() -> None:
    """If on-demand returns 200 and bid returns persistent 429, collect()
    must still produce observations from the on-demand response. This is the
    bug the fix addresses: previously, a single 429 discarded the entire run.
    """
    on_demand_offer = {
        "id": 1,
        "gpu_name": "H100_SXM5",
        "num_gpus": 1,
        "dph_total": 3.25,
        "geolocation": "US",
        "is_bid": False,
    }

    def handler(request: httpx.Request) -> httpx.Response:
        # Vast bundles the query into the `q` parameter; route by content.
        q = request.url.params.get("q", "")
        if '"type":"on-demand"' in q:
            return httpx.Response(200, json={"offers": [on_demand_offer]})
        return httpx.Response(429, json={"error": "rate limited"})

    transport = httpx.MockTransport(handler)

    # Patch the AsyncClient constructor inside the vast module so the
    # collector's internal `httpx.AsyncClient(timeout=60.0)` is replaced
    # with one bound to our mock transport. Also zero out the backoffs so
    # the 429 path doesn't sleep through the real 1s+2s+4s schedule.
    from basis.collectors import vast as vast_module

    real_client_cls = vast_module.httpx.AsyncClient

    def make_client(*args: object, **kwargs: object) -> httpx.AsyncClient:
        return real_client_cls(transport=transport)

    monkeypatched_backoffs = (0.0, 0.0, 0.0)

    import unittest.mock

    with (
        unittest.mock.patch.object(vast_module.httpx, "AsyncClient", make_client),
        unittest.mock.patch.object(vast_module, "_DEFAULT_BACKOFFS", monkeypatched_backoffs),
    ):
        collector = VastCollector()
        observations = await collector.collect()

    assert len(observations) == 1, (
        "Expected the on-demand offer to survive even though bid endpoint hit 429"
    )
    assert observations[0].gpu_model_reported == "H100_SXM5"
    assert observations[0].commitment_type_reported == "on_demand"


async def test_vast_bid_offers_labeled_spot_and_not_cross_deduped() -> None:
    """Commitment type comes from the query, not the payload's `is_bid`.

    The Vast /bundles/ API returns `is_bid: false` on every offer of BOTH
    the on-demand and bid queries (verified live 2026-07-25; all 315,685
    pre-fix rows carried is_bid=false). A machine listed by both queries has
    two different prices — its fixed on-demand price and its current
    interruptible bid price — so cross-query dedup must NOT collapse them.
    See docs/analysis/2026-07-24-vast-bid-bug.md.
    """
    dual_od = {
        "id": 1,
        "gpu_name": "H100_SXM5",
        "num_gpus": 1,
        "dph_total": 3.25,
        "geolocation": "US",
        "is_bid": False,  # what the API really sends, even for bid offers
    }
    dual_bid = {**dual_od, "dph_total": 2.75}
    bid_only = {
        "id": 2,
        "gpu_name": "RTX 4090",
        "num_gpus": 1,
        "dph_total": 0.30,
        "geolocation": "PL",
        "is_bid": False,
    }

    def handler(request: httpx.Request) -> httpx.Response:
        q = request.url.params.get("q", "")
        if '"type":"on-demand"' in q:
            return httpx.Response(200, json={"offers": [dual_od]})
        return httpx.Response(200, json={"offers": [dual_bid, bid_only]})

    transport = httpx.MockTransport(handler)

    import unittest.mock

    from basis.collectors import vast as vast_module

    real_client_cls = vast_module.httpx.AsyncClient

    def make_client(*args: object, **kwargs: object) -> httpx.AsyncClient:
        return real_client_cls(transport=transport)

    with unittest.mock.patch.object(vast_module.httpx, "AsyncClient", make_client):
        observations = await VastCollector().collect()

    assert len(observations) == 3, (
        "Dual-listed machine must yield BOTH its on-demand and bid observations"
    )
    by_key = {
        (obs.provider_metadata["offer_id"], obs.commitment_type_reported): obs
        for obs in observations
    }
    assert by_key[(1, "on_demand")].price_hourly == 3.25
    assert by_key[(1, "spot")].price_hourly == 2.75
    assert by_key[(2, "spot")].price_hourly == 0.30
    assert by_key[(1, "on_demand")].provider_metadata["query_type"] == "on-demand"
    assert by_key[(1, "spot")].provider_metadata["query_type"] == "bid"
    # The payload is stored untouched — is_bid stays false even on spot rows.
    assert all(obs.raw_payload["is_bid"] is False for obs in observations)


async def test_vast_collect_sends_bearer_auth_when_key_configured(monkeypatch) -> None:
    """With VAST_API_KEY set, every Vast request must carry a Bearer header.

    Vast began capping *unauthenticated* /bundles/ responses at 64 cheapest-first
    offers on 2026-06-23 (dropping the premium H100 tier from collection);
    authenticating lifts the cap. This guards the header wiring in _fetch_offers.
    """
    import unittest.mock

    from basis.collectors import vast as vast_module

    monkeypatch.setattr(vast_module.settings, "vast_api_key", "test-key-123")

    seen_auth: list[str | None] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen_auth.append(request.headers.get("Authorization"))
        return httpx.Response(200, json={"offers": []})

    transport = httpx.MockTransport(handler)
    real_client_cls = vast_module.httpx.AsyncClient

    def make_client(*args: object, **kwargs: object) -> httpx.AsyncClient:
        # Preserve the default headers (auth) while binding the mock transport.
        return real_client_cls(transport=transport, headers=kwargs.get("headers"))

    with unittest.mock.patch.object(vast_module.httpx, "AsyncClient", make_client):
        await VastCollector().collect()

    assert seen_auth, "expected at least one Vast request to be issued"
    assert all(h == "Bearer test-key-123" for h in seen_auth), seen_auth


async def test_vast_collect_omits_auth_header_when_no_key(monkeypatch) -> None:
    """With no key configured, requests carry no Authorization header (the prior
    keyless behaviour is preserved; the collector still runs, just capped)."""
    import unittest.mock

    from basis.collectors import vast as vast_module

    monkeypatch.setattr(vast_module.settings, "vast_api_key", "")

    seen_auth: list[str | None] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen_auth.append(request.headers.get("Authorization"))
        return httpx.Response(200, json={"offers": []})

    transport = httpx.MockTransport(handler)
    real_client_cls = vast_module.httpx.AsyncClient

    def make_client(*args: object, **kwargs: object) -> httpx.AsyncClient:
        return real_client_cls(transport=transport, headers=kwargs.get("headers"))

    with unittest.mock.patch.object(vast_module.httpx, "AsyncClient", make_client):
        await VastCollector().collect()

    assert seen_auth, "expected at least one Vast request to be issued"
    assert all(h is None for h in seen_auth), seen_auth


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


# --- Finding 1: Vast retrieval is exhaustive by construction ------------------



def _fake_vast_server(offers: list[dict], cap: int):
    """A /bundles/ stand-in that honours filters and order, then truncates at ``cap``.

    Mirrors the observed production behaviour: ``limit`` is ignored above the
    server's own cap, and rows are returned cheapest-first unless asked
    otherwise. ``calls`` records every query so tests can assert structure.
    """
    calls: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        q = json.loads(request.url.params["q"])
        calls.append(q)
        rows = list(offers)
        if "type" in q:
            rows = [o for o in rows if o["type"] == q["type"]]
        if "gpu_name" in q:
            rows = [o for o in rows if o["gpu_name"] == q["gpu_name"]["eq"]]
        if "dph_total" in q:
            f = q["dph_total"]
            rows = [o for o in rows if o["dph_total"] >= f.get("gte", -1e9)]
            if "lt" in f:
                rows = [o for o in rows if o["dph_total"] < f["lt"]]
        desc = q.get("order", [["dph_total", "asc"]])[0][1] == "desc"
        rows.sort(key=lambda o: (o["dph_total"], o["id"]), reverse=desc)
        return httpx.Response(200, json={"offers": rows[:cap]})

    return handler, calls


def _offers(n: int, *, price=lambda i: 0.05 + i * 0.01, gpu="RTX 4090") -> list[dict]:
    return [
        {
            "id": i,
            "gpu_name": gpu if i % 7 else "H100 SXM",
            "dph_total": price(i),
            "num_gpus": 1,
            "rentable": True,
            "type": "on-demand",
            "geolocation": "Washington, US",
        }
        for i in range(n)
    ]


@pytest.mark.asyncio
async def test_vast_band_partition_recovers_every_offer_above_cap() -> None:
    """1,500 offers behind a 512-row cap: one page is censored, bands are not."""
    offers = _offers(1500)
    handler, _calls = _fake_vast_server(offers, cap=512)
    collector = VastCollector()
    collector._transport = httpx.MockTransport(handler)
    collector.result_cap = 512

    fetched = await collector._fetch_offers()
    on_demand = [o for o, c in fetched if c == "on_demand"]
    assert len(on_demand) == 1500
    assert {o["id"] for o in on_demand} == {o["id"] for o in offers}

    health = next(h for h in collector.health if h.commitment_type == "on_demand")
    assert health.exhaustive, health.as_record()
    assert health.bands_incomplete == 0
    assert all(b.returned < 512 for b in health.bands)
    assert health.desc_check_missing == 0
    assert health.probe_missing == {"H100 SXM": 0}
    assert len(health.bands) >= 3


@pytest.mark.asyncio
async def test_vast_single_page_would_have_missed_the_premium_tier() -> None:
    """The control: the pre-review single query returned the cheapest 512 only."""
    offers = _offers(1500)
    handler, _ = _fake_vast_server(offers, cap=512)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        q = {
            "rentable": {"eq": True},
            "type": "on-demand",
            "order": [["dph_total", "asc"]],
            "limit": 10000,
        }
        page = await VastCollector._fetch_query(client, json.dumps(q))
    assert len(page) == 512
    assert max(o["dph_total"] for o in page) < max(o["dph_total"] for o in offers)


@pytest.mark.asyncio
async def test_vast_unsplittable_band_is_recorded_incomplete_not_assumed() -> None:
    """1,000 offers all at one price cannot be separated by price. Say so."""
    offers = _offers(1000, price=lambda i: 1.25)
    handler, _ = _fake_vast_server(offers, cap=512)
    collector = VastCollector()
    collector._transport = httpx.MockTransport(handler)
    collector.result_cap = 512

    await collector._fetch_offers()
    health = next(h for h in collector.health if h.commitment_type == "on_demand")
    assert not health.exhaustive
    assert health.bands_incomplete >= 1
    assert (health.desc_check_missing or 0) > 0


@pytest.mark.asyncio
async def test_vast_health_record_shape() -> None:
    offers = _offers(100)
    handler, _ = _fake_vast_server(offers, cap=512)
    collector = VastCollector()
    collector._transport = httpx.MockTransport(handler)
    collector.result_cap = 512
    await collector._fetch_offers()
    rec = collector.health[0].as_record()
    assert set(rec) == {
        "commitment_type", "cap", "bands_total", "bands_incomplete", "offers_returned",
        "offers_unique", "exhaustive", "desc_check_missing", "probe_missing",
    }
    assert rec["exhaustive"] is True and rec["bands_total"] == 1
