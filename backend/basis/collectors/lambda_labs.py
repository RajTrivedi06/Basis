"""Lambda Labs GPU cloud collector.

Data source: REST API at https://cloud.lambdalabs.com/api/v1/instance-types
Auth: Requires free API key (get one at https://cloud.lambda.ai/api-keys)
Format: JSON map of instance types with on-demand pricing and availability

Pricing is in US cents per hour (integer). Divide by 100 for dollars.
Instance prices include multiple GPUs — divide by gpu count for per-GPU price.

See docs/data_sources.md for full documentation.
"""

import logging

import httpx

from basis.collectors.base import BaseCollector
from basis.config import settings
from basis.schemas.raw import RawObservationCreate

logger = logging.getLogger(__name__)

LAMBDA_API_URL = "https://cloud.lambdalabs.com/api/v1/instance-types"


class LambdaLabsCollector(BaseCollector):
    """Collects GPU pricing from Lambda Labs' REST API.

    Lambda has simple on-demand pricing that doesn't change often.
    Returns instance types with GPU specs, pricing, and regional availability.
    """

    source_name = "lambda_labs"

    async def collect(self) -> list[RawObservationCreate]:
        """Fetch all instance types and pricing from Lambda Labs."""
        # Lambda Labs API key is optional in our config — stored as VAST_API_KEY pattern
        # For now, check if we can get a key from settings or env
        api_key = getattr(settings, "lambda_api_key", "")
        if not api_key:
            logger.warning("Lambda Labs API key not configured — skipping collection")
            return []

        now = self.now_utc()
        instance_types = await self._fetch_instance_types(api_key)
        observations: list[RawObservationCreate] = []

        for name, data in instance_types.items():
            try:
                obs_list = self._parse_instance_type(name, data, now)
                observations.extend(obs_list)
            except Exception:
                logger.warning("Failed to parse Lambda instance type %s", name, exc_info=True)

        return observations

    async def _fetch_instance_types(self, api_key: str) -> dict:
        """Call the Lambda Labs API and return instance type data."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                LAMBDA_API_URL,
                headers={"Authorization": f"Bearer {api_key}"},
            )
            response.raise_for_status()
            data = response.json()

        instance_types = data.get("data", {})
        logger.info("Lambda Labs API returned %d instance types", len(instance_types))
        return instance_types

    @staticmethod
    def _parse_instance_type(
        name: str, data: dict, collected_at
    ) -> list[RawObservationCreate]:
        """Convert a Lambda instance type into observations.

        One observation per region where the instance is available.
        If no regions have capacity, still create one observation (with no region)
        since the pricing is still valid.
        """
        instance_type = data.get("instance_type", {})
        specs = instance_type.get("specs", {})
        regions = data.get("regions_with_capacity_available", [])

        price_cents = instance_type.get("price_cents_per_hour", 0)
        if price_cents <= 0:
            return []

        gpu_count = specs.get("gpus", 1)
        price_dollars_per_gpu = (price_cents / 100.0) / max(gpu_count, 1)

        gpu_description = instance_type.get("gpu_description", "")

        metadata = {
            "instance_name": name,
            "description": instance_type.get("description", ""),
            "gpu_count": gpu_count,
            "instance_price_cents_per_hour": price_cents,
            "vcpus": specs.get("vcpus"),
            "memory_gib": specs.get("memory_gib"),
            "storage_gib": specs.get("storage_gib"),
        }

        observations: list[RawObservationCreate] = []

        if regions:
            # One observation per available region
            for region in regions:
                region_name = region.get("name", "")
                region_desc = region.get("description", "")
                observations.append(
                    RawObservationCreate(
                        source="lambda_labs",
                        collected_at=collected_at,
                        raw_payload=data,
                        gpu_model_reported=gpu_description,
                        price_hourly=price_dollars_per_gpu,
                        region_reported=f"{region_name} ({region_desc})" if region_desc else region_name,
                        commitment_type_reported="on_demand",
                        provider_metadata={**metadata, "region_name": region_name},
                    )
                )
        else:
            # No capacity anywhere, but price is still valid
            observations.append(
                RawObservationCreate(
                    source="lambda_labs",
                    collected_at=collected_at,
                    raw_payload=data,
                    gpu_model_reported=gpu_description,
                    price_hourly=price_dollars_per_gpu,
                    region_reported=None,
                    commitment_type_reported="on_demand",
                    provider_metadata={**metadata, "in_stock": False},
                )
            )

        return observations
