"""Vast.ai GPU marketplace collector.

Data source: Public API at https://console.vast.ai/api/v0/bundles/
Auth: A free API key is now effectively required. As of 2026-06-23 Vast caps
    *unauthenticated* responses at 64 offers and silently ignores the `limit`
    parameter; because results are ordered cheapest-first, that drops the entire
    premium tier (H100, etc.) from collection. Set VAST_API_KEY to lift the cap.
    See docs/analysis/2026-07-11-findings-refresh.md.
Format: JSON with {"offers": [...]} containing ~95 fields per offer

Key fields used:
- gpu_name: GPU model (e.g., "RTX 4090", "H100 NVL")
- dph_total: total price per hour in USD (GPU + storage + bandwidth)
- geolocation: location string (e.g., "Washington, US")
- verification: "verified", "unverified", or "deverified"
- reliability: 0-1 reliability score
- num_gpus: number of GPUs in the offer
- cpu_cores_effective, cpu_ram, disk_space: bundled resources

Commitment type comes from WHICH query returned the offer (type=on-demand vs
type=bid), NOT from the payload's `is_bid` field: /bundles/ responses carry
`is_bid: false` on every offer of BOTH queries (verified live 2026-07-25 and
across all 315,685 pre-fix stored rows). A machine listed by both queries
yields TWO observations with different prices — its fixed on-demand price and
its current interruptible (bid) price. These are distinct commitment products,
not duplicates. See docs/analysis/2026-07-24-vast-bid-bug.md.

See docs/data_sources.md for full documentation.
"""

import asyncio
import logging
from typing import Any

import httpx

from basis.collectors.base import BaseCollector
from basis.config import settings
from basis.schemas.raw import RawObservationCreate

logger = logging.getLogger(__name__)

VAST_API_URL = "https://console.vast.ai/api/v0/bundles/"

_RETRYABLE_STATUS_CODES: frozenset[int] = frozenset({429, 500, 502, 503, 504})
_DEFAULT_BACKOFFS: tuple[float, ...] = (1.0, 2.0, 4.0)


def _auth_headers() -> dict[str, str]:
    """Bearer-auth header for the Vast.ai API when a key is configured.

    Vast caps *unauthenticated* /bundles/ responses at 64 cheapest-first offers
    (the `limit` param is ignored), which excludes the premium tier from
    collection. A free API key lifts the cap. Returns an empty dict when no key
    is set, preserving the prior keyless behaviour.
    """
    key = settings.vast_api_key
    return {"Authorization": f"Bearer {key}"} if key else {}


async def _request_with_retry(
    client: httpx.AsyncClient,
    url: str,
    *,
    params: dict[str, str] | None = None,
    backoffs: tuple[float, ...] = _DEFAULT_BACKOFFS,
) -> httpx.Response:
    """GET ``url`` with exponential backoff on transient failures.

    Retries on HTTP 429, HTTP 5xx, and httpx.TransportError (connection drops,
    timeouts). Other 4xx responses raise immediately — they signal real client
    errors that won't be fixed by waiting. Total attempts = ``len(backoffs)``;
    the final attempt re-raises whatever exception it produced.
    """
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
                    "Vast.ai request returned %d, retrying in %.1fs (attempt %d/%d)",
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
                    "Vast.ai request failed with transport error (%s), retrying in %.1fs "
                    "(attempt %d/%d)",
                    type(exc).__name__,
                    delay,
                    attempt,
                    len(backoffs),
                )
                await asyncio.sleep(delay)
    assert last_exc is not None  # loop only exits via return or via this path
    raise last_exc


class VastCollector(BaseCollector):
    """Collects GPU pricing data from the Vast.ai marketplace.

    Vast.ai is the richest public dataset -- thousands of live offers with
    pricing, hardware specs, location, reliability score, and verification status.
    """

    source_name = "vast"

    async def collect(self) -> list[RawObservationCreate]:
        """Fetch all rentable GPU offers from Vast.ai."""
        now = self.now_utc()
        offers = await self._fetch_offers()
        observations: list[RawObservationCreate] = []

        for offer, commitment_type in offers:
            try:
                obs = self._parse_offer(offer, now, commitment_type)
                if obs is not None:
                    observations.append(obs)
            except Exception:
                logger.warning("Failed to parse Vast.ai offer id=%s", offer.get("id"), exc_info=True)

        return observations

    async def _fetch_offers(self) -> list[tuple[dict, str]]:
        """Call the Vast.ai API and return (offer, commitment_type) pairs.

        Fetches both on-demand and spot (bid) offers separately, since
        the API's type filter only accepts one at a time.
        The default API limit is 64, so we set a high limit to get everything.

        The commitment type of each offer is the query that returned it —
        the payload's `is_bid` field is always false and cannot be used
        (see module docstring). Offers are deduplicated WITHIN a query only:
        a machine listed by both queries is two distinct price observations
        (fixed on-demand price vs current interruptible bid price), so no
        cross-query dedup is applied.

        If one query fails after retries (e.g. persistent 429), the other
        query's offers are still returned. Both failing yields an empty list,
        matching the prior all-or-nothing behavior at that boundary.
        """
        all_offers: list[tuple[dict, str]] = []

        queries: list[tuple[str, str, str]] = [
            (
                "on-demand",
                "on_demand",
                '{"rentable":{"eq":true},"order":[["dph_total","asc"]],"type":"on-demand","limit":10000}',
            ),
            (
                "bid",
                "spot",
                '{"rentable":{"eq":true},"order":[["dph_total","asc"]],"type":"bid","limit":10000}',
            ),
        ]

        headers = _auth_headers()
        if not headers:
            logger.warning(
                "Vast.ai API key not configured (VAST_API_KEY) — unauthenticated "
                "requests are capped at 64 cheapest-first offers and will miss the "
                "premium tier (e.g. H100). See "
                "docs/analysis/2026-07-11-findings-refresh.md."
            )

        async with httpx.AsyncClient(timeout=60.0, headers=headers) as client:
            for label, commitment_type, q in queries:
                try:
                    offers = await self._fetch_query(client, q)
                except (httpx.HTTPError, httpx.TransportError) as exc:
                    logger.warning(
                        "Vast.ai %s query failed after retries (%s); continuing with other endpoint",
                        label,
                        exc,
                    )
                    continue
                seen_ids: set[int] = set()
                for offer in offers:
                    oid = offer.get("id")
                    if oid not in seen_ids:
                        seen_ids.add(oid)
                        all_offers.append((offer, commitment_type))
                logger.info(
                    "Vast.ai %s query returned %d offers (running total: %d)",
                    label,
                    len(offers),
                    len(all_offers),
                )

        return all_offers

    @staticmethod
    async def _fetch_query(client: httpx.AsyncClient, query: str) -> list[dict[str, Any]]:
        """Run one Vast.ai bundles query through the retry helper.

        Returns the parsed offers list. Raises after exhausted retries; the
        caller decides whether to abort the run or proceed with partial data.
        """
        response = await _request_with_retry(client, VAST_API_URL, params={"q": query})
        data = response.json()
        offers: list[dict[str, Any]] = data.get("offers", [])
        return offers

    @staticmethod
    def _parse_offer(
        offer: dict, collected_at, commitment_type: str = "on_demand"
    ) -> RawObservationCreate | None:
        """Convert a single Vast.ai offer dict into a RawObservationCreate.

        ``commitment_type`` is supplied by the caller from the query that
        returned the offer ("on_demand" or "spot"); the payload's `is_bid`
        field is always false and must not be consulted (see module
        docstring). The default exists for fixture-driven tests that parse
        offers without query context.

        Returns None if the offer is missing required fields or has invalid data.
        """
        gpu_name = offer.get("gpu_name")
        dph_total = offer.get("dph_total")
        num_gpus = offer.get("num_gpus", 1)

        # Skip offers missing essential fields
        if not gpu_name or dph_total is None or dph_total <= 0:
            return None

        # Compute per-GPU price if the offer bundles multiple GPUs
        price_per_gpu = dph_total / num_gpus if num_gpus > 1 else dph_total

        return RawObservationCreate(
            source="vast",
            collected_at=collected_at,
            raw_payload=offer,
            gpu_model_reported=gpu_name,
            price_hourly=price_per_gpu,
            region_reported=offer.get("geolocation"),
            commitment_type_reported=commitment_type,
            provider_metadata={
                "num_gpus": num_gpus,
                "dph_total": dph_total,
                "dph_base": offer.get("dph_base"),
                "verification": offer.get("verification"),
                "reliability": offer.get("reliability"),
                "reliability2": offer.get("reliability2"),
                "hosting_type": offer.get("hosting_type"),
                "score": offer.get("score"),
                "dlperf": offer.get("dlperf"),
                "cpu_cores_effective": offer.get("cpu_cores_effective"),
                "cpu_ram_mb": offer.get("cpu_ram"),
                "disk_space_gb": offer.get("disk_space"),
                "inet_down_mbps": offer.get("inet_down"),
                "inet_up_mbps": offer.get("inet_up"),
                "gpu_ram_mb": offer.get("gpu_ram"),
                "gpu_total_ram_mb": offer.get("gpu_total_ram"),
                "total_flops": offer.get("total_flops"),
                "bw_nvlink": offer.get("bw_nvlink"),
                "pcie_bw": offer.get("pcie_bw"),
                "machine_id": offer.get("machine_id"),
                "offer_id": offer.get("id"),
                # Which /bundles/ query produced this row. raw_payload cannot
                # answer this (is_bid is always false), so record it here.
                "query_type": "bid" if commitment_type == "spot" else "on-demand",
            },
        )
