"""Vast.ai GPU marketplace collector.

Data source: Public API at https://console.vast.ai/api/v0/bundles/
Auth: None required (API key gives higher rate limits but is optional)
Format: JSON with {"offers": [...]} containing ~95 fields per offer

Key fields used:
- gpu_name: GPU model (e.g., "RTX 4090", "H100 NVL")
- dph_total: total price per hour in USD (GPU + storage + bandwidth)
- geolocation: location string (e.g., "Washington, US")
- is_bid: false = on-demand, true = interruptible/spot
- verification: "verified", "unverified", or "deverified"
- reliability: 0-1 reliability score
- num_gpus: number of GPUs in the offer
- cpu_cores_effective, cpu_ram, disk_space: bundled resources

See docs/data_sources.md for full documentation.
"""

import logging

import httpx

from basis.collectors.base import BaseCollector
from basis.schemas.raw import RawObservationCreate

logger = logging.getLogger(__name__)

VAST_API_URL = "https://console.vast.ai/api/v0/bundles/"


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

        for offer in offers:
            try:
                obs = self._parse_offer(offer, now)
                if obs is not None:
                    observations.append(obs)
            except Exception:
                logger.warning("Failed to parse Vast.ai offer id=%s", offer.get("id"), exc_info=True)

        return observations

    async def _fetch_offers(self) -> list[dict]:
        """Call the Vast.ai API and return the list of offer dicts.

        Fetches both on-demand and spot (bid) offers separately, since
        the API's type filter only accepts one at a time.
        The default API limit is 64, so we set a high limit to get everything.
        """
        all_offers: list[dict] = []
        seen_ids: set[int] = set()

        queries = [
            '{"rentable":{"eq":true},"order":[["dph_total","asc"]],"type":"on-demand","limit":10000}',
            '{"rentable":{"eq":true},"order":[["dph_total","asc"]],"type":"bid","limit":10000}',
        ]

        async with httpx.AsyncClient(timeout=60.0) as client:
            for q in queries:
                response = await client.get(VAST_API_URL, params={"q": q})
                response.raise_for_status()
                data = response.json()
                offers = data.get("offers", [])
                for offer in offers:
                    oid = offer.get("id")
                    if oid not in seen_ids:
                        seen_ids.add(oid)
                        all_offers.append(offer)
                logger.info("Vast.ai query returned %d offers (total unique: %d)", len(offers), len(all_offers))

        return all_offers

    @staticmethod
    def _parse_offer(offer: dict, collected_at) -> RawObservationCreate | None:
        """Convert a single Vast.ai offer dict into a RawObservationCreate.

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

        # Determine commitment type from the is_bid field
        is_bid = offer.get("is_bid", False)
        commitment_type = "spot" if is_bid else "on_demand"

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
            },
        )
