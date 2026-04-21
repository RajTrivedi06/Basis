"""TensorDock GPU marketplace collector.

Data source: Public API at https://dashboard.tensordock.com/api/v2/locations
Auth: None required
Format: JSON with locations, each containing available GPUs with per-GPU pricing

TensorDock is a marketplace — the same GPU model appears at multiple locations
with different prices (hosts set their own). Prices are per-GPU-hour and do NOT
include CPU/RAM/storage costs (those are billed separately).

See docs/data_sources.md for full documentation.
"""

import logging

import httpx

from basis.collectors.base import BaseCollector
from basis.schemas.raw import RawObservationCreate

logger = logging.getLogger(__name__)

TENSORDOCK_API_URL = "https://dashboard.tensordock.com/api/v2/locations"


class TensorDockCollector(BaseCollector):
    """Collects GPU pricing from TensorDock's marketplace API.

    Each location has multiple GPU types with independent pricing. The same
    GPU model can appear at many locations with different prices.
    """

    source_name = "tensordock"

    async def collect(self) -> list[RawObservationCreate]:
        """Fetch all locations and GPU pricing from TensorDock."""
        now = self.now_utc()
        locations = await self._fetch_locations()
        observations: list[RawObservationCreate] = []

        for location in locations:
            try:
                obs_list = self._parse_location(location, now)
                observations.extend(obs_list)
            except Exception:
                logger.warning(
                    "Failed to parse TensorDock location %s",
                    location.get("id"),
                    exc_info=True,
                )

        return observations

    async def _fetch_locations(self) -> list[dict]:
        """Call the TensorDock API and return location data."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(TENSORDOCK_API_URL)
            response.raise_for_status()
            data = response.json()

        locations = data.get("data", {}).get("locations", [])
        logger.info("TensorDock API returned %d locations", len(locations))
        return locations

    @staticmethod
    def _parse_location(location: dict, collected_at) -> list[RawObservationCreate]:
        """Convert a TensorDock location into observations, one per GPU type."""
        city = location.get("city", "")
        state = location.get("stateprovince", "")
        country = location.get("country", "")
        tier = location.get("tier")
        location_id = location.get("id", "")

        region_str = ", ".join(filter(None, [city, state, country]))

        gpus = location.get("gpus", [])
        observations: list[RawObservationCreate] = []

        for gpu_data in gpus:
            gpu_key = gpu_data.get("v0Name", "")
            price = gpu_data.get("price_per_hr")
            if not price or price <= 0:
                continue

            max_count = gpu_data.get("max_count", 0)
            if max_count <= 0:
                continue  # No availability

            display_name = gpu_data.get("displayName", gpu_key)
            resources = gpu_data.get("resources", {})
            pricing = gpu_data.get("pricing", {})
            network = gpu_data.get("network_features", {})

            observations.append(
                RawObservationCreate(
                    source="tensordock",
                    collected_at=collected_at,
                    raw_payload={
                        "location": {
                            "id": location_id,
                            "city": city,
                            "stateprovince": state,
                            "country": country,
                            "tier": tier,
                        },
                        "gpu": gpu_data,
                        "gpu_key": gpu_key,
                    },
                    gpu_model_reported=display_name,
                    price_hourly=price,
                    region_reported=region_str or None,
                    commitment_type_reported="on_demand",
                    provider_metadata={
                        "v0_name": gpu_key,
                        "location_id": location_id,
                        "location_tier": tier,
                        "max_count": max_count,
                        "max_vcpus": resources.get("max_vcpus"),
                        "max_ram_gb": resources.get("max_ram_gb"),
                        "max_storage_gb": resources.get("max_storage_gb"),
                        "per_vcpu_hr": pricing.get("per_vcpu_hr"),
                        "per_gb_ram_hr": pricing.get("per_gb_ram_hr"),
                        "per_gb_storage_hr": pricing.get("per_gb_storage_hr"),
                        "dedicated_ip": network.get("dedicated_ip_available"),
                    },
                )
            )

        return observations
