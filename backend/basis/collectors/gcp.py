"""GCP Cloud Billing Catalog collector.

Data source: https://cloudbilling.googleapis.com/v1/services/{serviceId}/skus
Auth: GCP API key (GCP_API_KEY)
Format: Paginated JSON SKU list for Compute Engine GPU attach prices

GPU SKUs are attached-GPU line items (category.resourceGroup == "GPU").
Prices are already per-GPU-hour — no division by GPU count.

See docs/02-reference/data-sources.md for full documentation.
"""

import asyncio
import logging
import re
from typing import Any

import httpx

from basis.collectors.base import BaseCollector
from basis.config import settings
from basis.schemas.raw import RawObservationCreate

logger = logging.getLogger(__name__)

# The Cloud Billing API key travels as a URL query parameter, and httpx logs
# full request URLs at INFO — which would write the key into journald on every
# collection run. Cap the httpx logger at WARNING; this module is the only
# collector that puts a credential in a URL.
logging.getLogger("httpx").setLevel(logging.WARNING)

# Verified via GET https://cloudbilling.googleapis.com/v1/services?key=...
# displayName "Compute Engine", serviceId 6F81-5844-456A.
GCP_COMPUTE_ENGINE_SERVICE_ID = "6F81-5844-456A"
GCP_SKUS_URL = (
    f"https://cloudbilling.googleapis.com/v1/services/{GCP_COMPUTE_ENGINE_SERVICE_ID}/skus"
)

# Description substring -> gpu_model_reported. Longer/more specific keys first.
GPU_DESCRIPTION_MAP: tuple[tuple[str, str], ...] = (
    ("H100 80GB", "H100 80GB"),
    ("A100 80GB", "A100 80GB"),
    ("A100", "A100"),
    ("L4", "L4"),
    ("T4", "T4"),
    ("V100", "V100"),
    ("P100", "P100"),
)

_CONCRETE_REGION_RE = re.compile(r"^[a-z]+-[a-z]+[0-9]+$")
_RETRYABLE_STATUS_CODES: frozenset[int] = frozenset({429, 500, 502, 503, 504})
_DEFAULT_BACKOFFS: tuple[float, ...] = (1.0, 2.0, 4.0)


def unit_price_to_usd(units: Any, nanos: Any) -> float | None:
    """Convert GCP Money {units, nanos} to USD float."""
    try:
        units_int = int(units)
        nanos_int = int(nanos)
    except (TypeError, ValueError):
        return None
    return units_int + nanos_int / 1_000_000_000


def match_gpu_model(description: str) -> str | None:
    """Map a SKU description to gpu_model_reported via exact substring rules."""
    for needle, model in GPU_DESCRIPTION_MAP:
        if needle in description:
            return model
    return None


def classify_commitment(description: str) -> str | None:
    """Classify commitment type from SKU description. None => skip-and-log."""
    if "Commitment v1:" in description:
        if "1 Year" in description:
            return "reserved_1y"
        if "3 Year" in description:
            return "reserved_3y"
        return None

    if "Spot Preemptible" in description or "Preemptible" in description:
        return "spot"

    if "attached to VMs" in description:
        return "on_demand"

    if "GPU running in" in description:
        return "on_demand"

    return None


def is_concrete_region(region: str) -> bool:
    """Return True for a single GCP region like us-central1."""
    return bool(_CONCRETE_REGION_RE.match(region))


def resolve_region_reported(service_regions: list[Any]) -> tuple[str | None, bool]:
    """Return (region_reported, is_multi_region) for a SKU's serviceRegions."""
    if not service_regions:
        return None, True

    first = service_regions[0]
    if not isinstance(first, str) or not first:
        return None, True

    if len(service_regions) > 1:
        return first, True

    if is_concrete_region(first):
        return first, False

    return first, True


async def _request_with_retry(
    client: httpx.AsyncClient,
    url: str,
    *,
    params: dict[str, str] | None = None,
    backoffs: tuple[float, ...] = _DEFAULT_BACKOFFS,
) -> httpx.Response:
    """GET a GCP billing page with retry on 429, 5xx, and transport errors."""
    last_exc: Exception | None = None
    for attempt, delay in enumerate(backoffs, start=1):
        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
            return response
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code not in _RETRYABLE_STATUS_CODES:
                raise
            last_exc = exc
            if attempt < len(backoffs):
                logger.info(
                    "GCP Cloud Billing returned %d, retrying in %.1fs (attempt %d/%d)",
                    exc.response.status_code,
                    delay,
                    attempt,
                    len(backoffs),
                )
                await asyncio.sleep(delay)
        except httpx.TransportError as exc:
            last_exc = exc
            if attempt < len(backoffs):
                logger.info(
                    "GCP Cloud Billing transport error (%s), retrying in %.1fs "
                    "(attempt %d/%d)",
                    type(exc).__name__,
                    delay,
                    attempt,
                    len(backoffs),
                )
                await asyncio.sleep(delay)

    assert last_exc is not None
    raise last_exc


class GCPCollector(BaseCollector):
    """Collect GPU attach prices from the GCP Cloud Billing Catalog API."""

    source_name = "gcp"

    async def collect(self) -> list[RawObservationCreate]:
        """Fetch all GPU SKU pages and parse attach prices."""
        if not settings.gcp_api_key:
            logger.warning(
                "GCP API key not configured (GCP_API_KEY) — skipping GCP Cloud Billing "
                "collection"
            )
            return []

        try:
            skus = await self._fetch_skus()
        except (httpx.HTTPError, ValueError, TypeError) as exc:
            logger.warning("GCP Cloud Billing collection failed: %s", exc)
            return []

        collected_at = self.now_utc()
        observations: list[RawObservationCreate] = []
        multi_region_count = 0

        for sku in skus:
            try:
                observation, is_multi_region = self._parse_sku(sku, collected_at)
                if observation is not None:
                    observations.append(observation)
                    if is_multi_region:
                        multi_region_count += 1
            except Exception:
                logger.warning(
                    "Failed to parse GCP SKU skuId=%s description=%r",
                    sku.get("skuId"),
                    sku.get("description"),
                    exc_info=True,
                )

        if observations:
            multi_region_share = multi_region_count / len(observations)
            logger.info(
                "GCP multi-region SKU share: %d/%d (%.1f%%)",
                multi_region_count,
                len(observations),
                multi_region_share * 100,
            )

            commitment_counts: dict[str, int] = {}
            for obs in observations:
                ct = obs.commitment_type_reported or "unknown"
                commitment_counts[ct] = commitment_counts.get(ct, 0) + 1
            logger.info("GCP commitment mix: %s", commitment_counts)

        return observations

    async def _fetch_skus(self) -> list[dict[str, Any]]:
        """Fetch all SKU pages, following nextPageToken until exhausted."""
        skus: list[dict[str, Any]] = []
        params: dict[str, str] = {"key": settings.gcp_api_key}
        next_page_token: str | None = None
        page_number = 0

        async with httpx.AsyncClient(timeout=60.0) as client:
            while True:
                page_params = dict(params)
                if next_page_token:
                    page_params["pageToken"] = next_page_token

                response = await _request_with_retry(client, GCP_SKUS_URL, params=page_params)
                page = response.json()
                page_skus = page.get("skus")
                if not isinstance(page_skus, list):
                    raise ValueError("GCP Cloud Billing response missing skus list")

                skus.extend(page_skus)
                page_number += 1
                logger.info(
                    "GCP Cloud Billing page %d: %d SKUs (running total: %d)",
                    page_number,
                    len(page_skus),
                    len(skus),
                )

                next_page_token = page.get("nextPageToken") or None
                if not next_page_token:
                    break

        return skus

    @staticmethod
    def _parse_sku(
        sku: dict[str, Any], collected_at
    ) -> tuple[RawObservationCreate | None, bool]:
        """Convert one GCP billing SKU to a raw observation."""
        category = sku.get("category") or {}
        if category.get("resourceGroup") != "GPU":
            return None, False

        description = sku.get("description") or ""
        if not description:
            logger.warning("Skipping GCP GPU SKU skuId=%s with empty description", sku.get("skuId"))
            return None, False

        gpu_model = match_gpu_model(description)
        if gpu_model is None:
            logger.warning(
                "Skipping GCP GPU SKU skuId=%s with unknown GPU description=%r",
                sku.get("skuId"),
                description,
            )
            return None, False

        commitment_type = classify_commitment(description)
        if commitment_type is None:
            logger.warning(
                "Skipping ambiguous GCP GPU SKU skuId=%s description=%r",
                sku.get("skuId"),
                description,
            )
            return None, False

        pricing_info = sku.get("pricingInfo") or []
        if not pricing_info:
            logger.warning("Skipping GCP GPU SKU skuId=%s with no pricingInfo", sku.get("skuId"))
            return None, False

        pricing_expression = pricing_info[0].get("pricingExpression") or {}
        usage_unit = pricing_expression.get("usageUnit")
        if usage_unit != "h":
            logger.warning(
                "Skipping GCP GPU SKU skuId=%s with non-hourly usageUnit=%r",
                sku.get("skuId"),
                usage_unit,
            )
            return None, False

        tiered_rates = pricing_expression.get("tieredRates") or []
        if not tiered_rates:
            logger.warning("Skipping GCP GPU SKU skuId=%s with no tieredRates", sku.get("skuId"))
            return None, False

        unit_price = tiered_rates[-1].get("unitPrice") or {}
        if unit_price.get("currencyCode") not in (None, "USD"):
            logger.warning(
                "Skipping GCP GPU SKU skuId=%s with non-USD currency=%r",
                sku.get("skuId"),
                unit_price.get("currencyCode"),
            )
            return None, False

        price_hourly = unit_price_to_usd(unit_price.get("units", 0), unit_price.get("nanos", 0))
        if price_hourly is None or price_hourly <= 0:
            logger.warning(
                "Skipping GCP GPU SKU skuId=%s with invalid price units=%r nanos=%r",
                sku.get("skuId"),
                unit_price.get("units"),
                unit_price.get("nanos"),
            )
            return None, False

        service_regions = sku.get("serviceRegions") or []
        region_reported, is_multi_region = resolve_region_reported(service_regions)
        if region_reported is None:
            logger.warning(
                "Skipping GCP GPU SKU skuId=%s with no usable serviceRegions",
                sku.get("skuId"),
            )
            return None, False

        return (
            RawObservationCreate(
                source="gcp",
                collected_at=collected_at,
                raw_payload=sku,
                gpu_model_reported=gpu_model,
                price_hourly=price_hourly,
                region_reported=region_reported,
                commitment_type_reported=commitment_type,
                provider_metadata={
                    "skuId": sku.get("skuId"),
                    "description": description,
                    "usageType": category.get("usageType"),
                    "serviceRegions": service_regions,
                    "is_multi_region": is_multi_region,
                    "usageUnit": usage_unit,
                },
            ),
            is_multi_region,
        )
