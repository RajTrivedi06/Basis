"""Vast.ai GPU marketplace collector.

Data source: Public API at https://console.vast.ai/api/v0/bundles/
Auth: A free API key is required. Unauthenticated responses are capped at 64
    offers (2026-06-23); *authenticated* responses were found capped at 512
    regardless of ``limit`` (2026-09-06 review), which silently censored the
    premium tier from 2026-08-11. Neither cap is documented, so the collector
    does not trust any single response to be complete.

Completeness: offers are retrieved by recursive half-open price bands
    ``[lo, hi)``. A band that returns fewer rows than the observed cap is
    complete. A band at the cap is split at its median returned price and both
    halves are re-queried. A band that cannot be split further (every returned
    row at one price) is recorded INCOMPLETE — never assumed complete. The run's
    verdict is ``exhaustive = every band complete``. A descending-order page and
    an explicit H100 SXM probe are checked afterwards as supplementary alarms;
    they cannot certify exhaustiveness (two truncated pages can agree).
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
import json
import logging
from dataclasses import dataclass, field
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

    Unauthenticated /bundles/ responses are capped at 64 cheapest-first offers;
    authenticated ones at 512 (observed). Neither cap honours ``limit``. Returns
    an empty dict when no key is set, preserving the prior keyless behaviour;
    the band partition in ``_fetch_exhaustive`` is what guarantees coverage.
    """
    key = settings.vast_api_key
    return {"Authorization": f"Bearer {key}"} if key else {}


def _encode_query(q: dict[str, Any]) -> str:
    """Serialise a /bundles/ query compactly.

    The API accepts either form; the compact one matches the hand-written
    strings this collector used before band partitioning, keeps the URL short,
    and is what content-routed test handlers match on.
    """
    return json.dumps(q, separators=(",", ":"))


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



REQUEST_LIMIT = 10000
"""The ``limit`` we ask for. The server ignores it above its own cap."""

PROBE_GPU_NAMES: tuple[str, ...] = ("H100 SXM",)
"""SKU-specific probes run after collection as supplementary checks."""

MAX_BAND_DEPTH = 40


@dataclass(frozen=True)
class BandResult:
    """One price band ``[lo, hi)`` queried during exhaustive retrieval."""

    lo: float
    hi: float | None
    returned: int
    complete: bool


@dataclass
class VastQueryHealth:
    """Completeness record for one commitment query of one collection run.

    ``exhaustive`` is the structural verdict: every band returned fewer rows
    than the cap. ``desc_check_missing`` and ``probe_missing`` are supplementary
    alarms — a nonzero value means something was missed, but zero does not
    prove nothing was.
    """

    commitment_type: str
    cap: int
    bands: list[BandResult] = field(default_factory=list)
    offers_returned: int = 0
    offers_unique: int = 0
    desc_check_missing: int | None = None
    probe_missing: dict[str, int] = field(default_factory=dict)

    @property
    def exhaustive(self) -> bool:
        return bool(self.bands) and all(b.complete for b in self.bands)

    @property
    def bands_incomplete(self) -> int:
        return sum(1 for b in self.bands if not b.complete)

    def as_record(self) -> dict[str, Any]:
        return {
            "commitment_type": self.commitment_type,
            "cap": self.cap,
            "bands_total": len(self.bands),
            "bands_incomplete": self.bands_incomplete,
            "offers_returned": self.offers_returned,
            "offers_unique": self.offers_unique,
            "exhaustive": self.exhaustive,
            "desc_check_missing": self.desc_check_missing,
            "probe_missing": dict(self.probe_missing),
        }


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

    # Test seams: a transport for httpx.MockTransport, and an explicit cap so a
    # test need not touch settings.
    _transport: httpx.AsyncBaseTransport | None = None
    result_cap: int | None = None
    min_band_width: float | None = None

    # Completeness records for the most recent ``collect()``; one per commitment
    # query. Persisted by run_collect.py alongside the observations.
    health: list[VastQueryHealth]

    async def _fetch_offers(self) -> list[tuple[dict, str]]:
        """Fetch all offers, tagged with the commitment type of their query.

        Two queries: ``type=on-demand`` → "on_demand" and ``type=bid`` → "spot".
        Each is retrieved exhaustively by price band (module docstring). Offers
        are deduplicated WITHIN a query only: a machine listed by both queries is
        two distinct price observations (fixed on-demand price vs current bid),
        so no cross-query dedup is applied.

        If one query fails after retries the other query's offers are still
        returned. Both failing yields an empty list.
        """
        all_offers: list[tuple[dict, str]] = []
        self.health = []
        cap = self.result_cap if self.result_cap is not None else settings.vast_result_cap
        min_width = (
            self.min_band_width
            if self.min_band_width is not None
            else settings.vast_min_band_width
        )

        queries: list[tuple[str, str, dict[str, Any]]] = [
            ("on-demand", "on_demand", {"rentable": {"eq": True}, "type": "on-demand"}),
            ("bid", "spot", {"rentable": {"eq": True}, "type": "bid"}),
        ]

        headers = _auth_headers()
        if not headers:
            logger.warning(
                "Vast.ai API key not configured (VAST_API_KEY) — unauthenticated "
                "requests are capped at 64 cheapest-first offers. Band partitioning "
                "still runs, but the premium tier will be recorded as incomplete."
            )

        async with httpx.AsyncClient(
            timeout=60.0, headers=headers, transport=self._transport
        ) as client:
            for label, commitment_type, base in queries:
                health = VastQueryHealth(commitment_type=commitment_type, cap=cap)
                try:
                    offers = await self._fetch_exhaustive(
                        client, base, health, cap=cap, min_width=min_width
                    )
                except (httpx.HTTPError, httpx.TransportError) as exc:
                    logger.warning(
                        "Vast.ai %s query failed after retries (%s); continuing with other endpoint",
                        label,
                        exc,
                    )
                    continue

                seen_ids: set[Any] = set()
                for offer in offers:
                    oid = offer.get("id")
                    if oid not in seen_ids:
                        seen_ids.add(oid)
                        all_offers.append((offer, commitment_type))
                health.offers_returned = len(offers)
                health.offers_unique = len(seen_ids)

                try:
                    await self._supplementary_checks(client, base, seen_ids, health)
                except (httpx.HTTPError, httpx.TransportError) as exc:
                    logger.warning("Vast.ai %s supplementary checks failed: %s", label, exc)

                self.health.append(health)
                log = logger.info if health.exhaustive else logger.error
                log(
                    "Vast.ai %s: %d offers (%d unique) over %d bands, %d incomplete, "
                    "exhaustive=%s, desc_missing=%s, probe_missing=%s",
                    label,
                    health.offers_returned,
                    health.offers_unique,
                    len(health.bands),
                    health.bands_incomplete,
                    health.exhaustive,
                    health.desc_check_missing,
                    health.probe_missing,
                )

        return all_offers

    async def _fetch_exhaustive(
        self,
        client: httpx.AsyncClient,
        base: dict[str, Any],
        health: VastQueryHealth,
        *,
        cap: int,
        min_width: float,
    ) -> list[dict[str, Any]]:
        """Retrieve every offer matching ``base`` by recursive price bands.

        A band is complete when the server returned fewer than ``cap`` rows for
        it. A band at the cap is split at a price strictly inside it and both
        halves are re-queried; the truncated page itself is discarded so nothing
        is counted twice. A band that cannot be split — width at the floor,
        depth at the limit, or every returned row at one price — keeps what it
        returned and is recorded incomplete.
        """
        collected: list[dict[str, Any]] = []
        stack: list[tuple[float, float | None, int]] = [(0.0, None, 0)]

        while stack:
            lo, hi, depth = stack.pop()
            price_filter: dict[str, float] = {"gte": lo}
            if hi is not None:
                price_filter["lt"] = hi
            q = {
                **base,
                "dph_total": price_filter,
                "order": [["dph_total", "asc"]],
                "limit": REQUEST_LIMIT,
            }
            offers = await self._fetch_query(client, _encode_query(q))
            n = len(offers)

            if n < cap:
                health.bands.append(BandResult(lo, hi, n, True))
                collected.extend(offers)
                continue

            split = self._split_point(offers, lo, hi)
            width = None if hi is None else hi - lo
            splittable = (
                split is not None
                and depth < MAX_BAND_DEPTH
                and (width is None or width > min_width)
            )
            if not splittable:
                health.bands.append(BandResult(lo, hi, n, False))
                collected.extend(offers)
                logger.warning(
                    "Vast.ai band [%s, %s) returned %d rows at the cap and cannot be "
                    "split further; recorded INCOMPLETE",
                    lo,
                    hi,
                    n,
                )
                continue

            assert split is not None
            stack.append((split, hi, depth + 1))
            stack.append((lo, split, depth + 1))

        return collected

    @staticmethod
    def _split_point(
        offers: list[dict[str, Any]], lo: float, hi: float | None
    ) -> float | None:
        """A price strictly inside ``[lo, hi)`` to split a truncated band at.

        Prefers the median of the returned prices for balance; falls back to
        the smallest returned price above ``lo``. ``None`` when every returned
        row sits at the band's lower edge — price cannot separate them.
        """
        prices = sorted(float(o.get("dph_total") or 0.0) for o in offers)
        if not prices:
            return None
        inside = lambda p: p > lo and (hi is None or p < hi)  # noqa: E731
        median = prices[len(prices) // 2]
        if inside(median):
            return median
        for p in prices:
            if inside(p):
                return p
        return None

    async def _supplementary_checks(
        self,
        client: httpx.AsyncClient,
        base: dict[str, Any],
        collected_ids: set[Any],
        health: VastQueryHealth,
    ) -> None:
        """Alarms that can catch a miss but cannot certify completeness."""
        desc_q = {**base, "order": [["dph_total", "desc"]], "limit": REQUEST_LIMIT}
        desc = await self._fetch_query(client, _encode_query(desc_q))
        health.desc_check_missing = sum(1 for o in desc if o.get("id") not in collected_ids)

        for name in PROBE_GPU_NAMES:
            probe_q = {
                **base,
                "gpu_name": {"eq": name},
                "order": [["dph_total", "asc"]],
                "limit": REQUEST_LIMIT,
            }
            probe = await self._fetch_query(client, _encode_query(probe_q))
            health.probe_missing[name] = sum(
                1 for o in probe if o.get("id") not in collected_ids
            )

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
