"""Azure Retail Prices collector.

Data source: https://prices.azure.com/api/retail/prices
Auth: None
Format: Paginated JSON retail-price items

Azure virtual-machine prices are quoted per instance. Each mapped VM size has
an explicit GPU model and count, so prices are divided by GPU count before
being emitted. Reservation prices are upfront totals and are additionally
divided by the documented reservation term in hours.

Only VM sizes with a documented, unambiguous GPU model and count are queried.
Unknown sizes, pricing types, and ambiguous reservation shapes are skipped and
logged in accordance with ADR-0002.
"""

import asyncio
import logging
from datetime import datetime
from typing import Any

import httpx

from basis.collectors.base import BaseCollector
from basis.schemas.raw import RawObservationCreate

logger = logging.getLogger(__name__)

AZURE_RETAIL_PRICES_URL = "https://prices.azure.com/api/retail/prices"

# Azure ARM VM size -> (GPU model reported to Basis, GPU count per instance).
# Counts and variants come from the corresponding Microsoft Learn VM-size pages.
# Fractional NVadsA10 profiles are intentionally excluded: they do not expose a
# complete 24 GB A10 and therefore are not fungible with the canonical A10 SKU.
AZURE_GPU_VM_SIZES: dict[str, tuple[str, int]] = {
    "Standard_ND96isr_H100_v5": ("H100 SXM", 8),
    "Standard_ND96asr_v4": ("A100 SXM 40GB", 8),
    "Standard_ND96amsr_A100_v4": ("A100 SXM 80GB", 8),
    "Standard_NC24ads_A100_v4": ("A100 PCIe", 1),
    "Standard_NC48ads_A100_v4": ("A100 PCIe", 2),
    "Standard_NC96ads_A100_v4": ("A100 PCIe", 4),
    "Standard_NC4as_T4_v3": ("Tesla T4", 1),
    "Standard_NC8as_T4_v3": ("Tesla T4", 1),
    "Standard_NC16as_T4_v3": ("Tesla T4", 1),
    "Standard_NC64as_T4_v3": ("Tesla T4", 4),
    "Standard_NV36ads_A10_v5": ("A10", 1),
    "Standard_NV36adms_A10_v5": ("A10", 1),
    "Standard_NV72ads_A10_v5": ("A10", 2),
}

_RETRYABLE_STATUS_CODES: frozenset[int] = frozenset({429, 500, 502, 503, 504})
_DEFAULT_BACKOFFS: tuple[float, ...] = (1.0, 2.0, 4.0)
_RESERVATION_TERM_HOURS: dict[str, int] = {
    "1 Year": 365 * 24,
    "3 Years": 3 * 365 * 24,
}
_RESERVATION_COMMITMENTS: dict[str, str] = {
    "1 Year": "reserved_1y",
    "3 Years": "reserved_3y",
}


def _odata_filter() -> str:
    """Build a compact OData family filter; the exact map remains authoritative."""
    sku_filter = (
        "armSkuName eq 'Standard_ND96isr_H100_v5' "
        "or armSkuName eq 'Standard_ND96asr_v4' "
        "or armSkuName eq 'Standard_ND96amsr_A100_v4' "
        "or (contains(armSkuName, 'Standard_NC') "
        "and contains(armSkuName, 'ads_A100_v4')) "
        "or (contains(armSkuName, 'Standard_NC') "
        "and contains(armSkuName, 'as_T4_v3')) "
        "or contains(armSkuName, 'Standard_NV36ad') "
        "or armSkuName eq 'Standard_NV72ads_A10_v5'"
    )
    price_filter = (
        "(priceType eq 'Consumption' or "
        "(priceType eq 'Reservation' and "
        "(reservationTerm eq '1 Year' or reservationTerm eq '3 Years')))"
    )
    return (
        f"serviceName eq 'Virtual Machines' and ({sku_filter}) "
        "and contains(productName, 'Windows') eq false "
        "and contains(meterName, 'Low Priority') eq false "
        "and contains(skuName, 'Low Priority') eq false "
        f"and {price_filter}"
    )


async def _request_with_retry(
    client: httpx.AsyncClient,
    url: str,
    *,
    params: dict[str, str] | None = None,
    backoffs: tuple[float, ...] = _DEFAULT_BACKOFFS,
) -> httpx.Response:
    """GET an Azure price page with retry on 429, 5xx, and transport errors."""
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
                    "Azure Retail Prices returned %d, retrying in %.1fs (attempt %d/%d)",
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
                    "Azure Retail Prices transport error (%s), retrying in %.1fs (attempt %d/%d)",
                    type(exc).__name__,
                    delay,
                    attempt,
                    len(backoffs),
                )
                await asyncio.sleep(delay)

    assert last_exc is not None
    raise last_exc


class AzureCollector(BaseCollector):
    """Collect mapped GPU VM prices from Azure's unauthenticated retail API."""

    source_name = "azure"

    async def collect(self) -> list[RawObservationCreate]:
        """Fetch every page and parse comparable Azure GPU VM price items."""
        try:
            items = await self._fetch_items()
        except (httpx.HTTPError, ValueError, TypeError) as exc:
            logger.warning("Azure Retail Prices collection failed: %s", exc)
            return []

        collected_at = self.now_utc()
        observations: list[RawObservationCreate] = []
        for item in items:
            try:
                observation = self._parse_item(item, collected_at)
                if observation is not None:
                    observations.append(observation)
            except Exception:
                logger.warning(
                    "Failed to parse Azure retail-price item meterId=%s armSkuName=%s",
                    item.get("meterId"),
                    item.get("armSkuName"),
                    exc_info=True,
                )
        return observations

    async def _fetch_items(self) -> list[dict[str, Any]]:
        """Fetch all OData pages, following NextPageLink until it is null."""
        items: list[dict[str, Any]] = []
        next_url: str | None = AZURE_RETAIL_PRICES_URL
        params: dict[str, str] | None = {
            "currencyCode": "USD",
            "$filter": _odata_filter(),
        }
        seen_urls: set[str] = set()
        page_number = 0

        async with httpx.AsyncClient(timeout=60.0) as client:
            while next_url:
                if next_url in seen_urls:
                    raise ValueError(f"Azure Retail Prices pagination cycle at {next_url}")
                seen_urls.add(next_url)

                response = await _request_with_retry(client, next_url, params=params)
                page = response.json()
                page_items = page.get("Items")
                if not isinstance(page_items, list):
                    raise ValueError("Azure Retail Prices response missing Items list")

                items.extend(page_items)
                page_number += 1
                logger.info(
                    "Azure Retail Prices page %d: %d items (running total: %d)",
                    page_number,
                    len(page_items),
                    len(items),
                )

                next_page_link = page.get("NextPageLink")
                if next_page_link is not None and not isinstance(next_page_link, str):
                    raise ValueError("Azure Retail Prices NextPageLink must be a string or null")
                next_url = next_page_link or None
                params = None

        return items

    @staticmethod
    def _parse_item(item: dict[str, Any], collected_at: datetime) -> RawObservationCreate | None:
        """Convert one full Azure retail-price item to a raw observation."""
        arm_sku_name = item.get("armSkuName")
        if not isinstance(arm_sku_name, str):
            logger.warning(
                "Skipping Azure item meterId=%s with invalid armSkuName=%r",
                item.get("meterId"),
                arm_sku_name,
            )
            return None
        gpu_info = AZURE_GPU_VM_SIZES.get(arm_sku_name)
        if gpu_info is None:
            logger.warning("Skipping unmapped Azure GPU VM size armSkuName=%r", arm_sku_name)
            return None

        gpu_model, gpu_count = gpu_info
        currency = item.get("currencyCode")
        if currency != "USD":
            logger.warning(
                "Skipping Azure item meterId=%s with non-USD currency=%r",
                item.get("meterId"),
                currency,
            )
            return None

        price_type = item.get("type") or item.get("priceType")
        names = f"{item.get('skuName', '')} {item.get('meterName', '')}".casefold()

        if "low priority" in names:
            logger.warning(
                "Skipping legacy Azure Low Priority item meterId=%s armSkuName=%s",
                item.get("meterId"),
                arm_sku_name,
            )
            return None

        commitment_type: str
        term_hours: int | None = None
        reservation_term: str | None = None
        if price_type == "Consumption":
            commitment_type = "spot" if "spot" in names else "on_demand"
            if item.get("unitOfMeasure") != "1 Hour":
                logger.warning(
                    "Skipping Azure Consumption item meterId=%s with unitOfMeasure=%r",
                    item.get("meterId"),
                    item.get("unitOfMeasure"),
                )
                return None
        elif price_type == "Reservation":
            raw_reservation_term = item.get("reservationTerm")
            if not isinstance(raw_reservation_term, str):
                logger.warning(
                    "Skipping ambiguous Azure Reservation item meterId=%s reservationTerm=%r",
                    item.get("meterId"),
                    raw_reservation_term,
                )
                return None
            reservation_term = raw_reservation_term
            term_hours = _RESERVATION_TERM_HOURS.get(reservation_term)
            reservation_commitment = _RESERVATION_COMMITMENTS.get(reservation_term)
            if term_hours is None or reservation_commitment is None:
                logger.warning(
                    "Skipping ambiguous Azure Reservation item meterId=%s reservationTerm=%r",
                    item.get("meterId"),
                    reservation_term,
                )
                return None
            commitment_type = reservation_commitment
        else:
            logger.warning(
                "Skipping unsupported Azure price type=%r meterId=%s",
                price_type,
                item.get("meterId"),
            )
            return None

        raw_price = item.get("retailPrice")
        if not isinstance(raw_price, (int, float, str)) or isinstance(raw_price, bool):
            logger.warning(
                "Skipping Azure item meterId=%s with invalid retailPrice=%r",
                item.get("meterId"),
                raw_price,
            )
            return None
        try:
            instance_price = float(raw_price)
        except (TypeError, ValueError):
            logger.warning(
                "Skipping Azure item meterId=%s with invalid retailPrice=%r",
                item.get("meterId"),
                raw_price,
            )
            return None
        if instance_price <= 0:
            logger.warning(
                "Skipping Azure item meterId=%s with non-positive retailPrice=%r",
                item.get("meterId"),
                raw_price,
            )
            return None

        if term_hours is None:
            instance_price_hourly = instance_price
            price_per_gpu_hour = instance_price_hourly / gpu_count
            conversion: dict[str, Any] = {
                "source_price_field": "retailPrice",
                "source_price_basis": "USD per instance hour",
                "source_price_usd": instance_price,
                "gpu_count": gpu_count,
                "formula": "retailPrice / gpu_count",
            }
        else:
            instance_price_hourly = instance_price / term_hours
            price_per_gpu_hour = instance_price_hourly / gpu_count
            conversion = {
                "source_price_field": "retailPrice",
                "source_price_basis": "USD upfront total",
                "source_price_usd": instance_price,
                "reservation_term": reservation_term,
                "term_hours": term_hours,
                "effective_instance_price_hourly_usd": instance_price_hourly,
                "gpu_count": gpu_count,
                "formula": "retailPrice / term_hours / gpu_count",
            }

        return RawObservationCreate(
            source="azure",
            collected_at=collected_at,
            raw_payload=item,
            gpu_model_reported=gpu_model,
            price_hourly=price_per_gpu_hour,
            region_reported=item.get("armRegionName"),
            commitment_type_reported=commitment_type,
            provider_metadata={
                "instance_type": arm_sku_name,
                "gpu_count": gpu_count,
                "priceType": price_type,
                "meterName": item.get("meterName"),
                "skuName": item.get("skuName"),
                "productName": item.get("productName"),
                "unitOfMeasure": item.get("unitOfMeasure"),
                "reservationTerm": reservation_term,
                "instance_price_hourly_usd": instance_price_hourly,
                "price_conversion": conversion,
            },
        )
