"""RunPod GPU cloud collector.

Data source: Public GraphQL API at https://api.runpod.io/graphql
Auth: None required for GPU pricing queries
Format: GraphQL response with ~43 GPU types, each with multiple pricing tiers

Each GPU type returns up to 6 price points:
- communityPrice / securePrice: on-demand pricing for community vs secure cloud
- communitySpotPrice / secureSpotPrice: interruptible spot pricing
- oneMonthPrice, threeMonthPrice, sixMonthPrice: reserved commitments

A price of 0 or null means that tier is unavailable, not free.

See docs/data_sources.md for full documentation.
"""

import logging

import httpx

from basis.collectors.base import BaseCollector
from basis.schemas.raw import RawObservationCreate

logger = logging.getLogger(__name__)

RUNPOD_GRAPHQL_URL = "https://api.runpod.io/graphql"

GPU_TYPES_QUERY = """
{
  gpuTypes {
    id
    displayName
    manufacturer
    memoryInGb
    communityCloud
    secureCloud
    communityPrice
    securePrice
    communitySpotPrice
    secureSpotPrice
    oneWeekPrice
    oneMonthPrice
    threeMonthPrice
    sixMonthPrice
    maxGpuCount
    maxGpuCountCommunityCloud
    maxGpuCountSecureCloud
    lowestPrice(input: { gpuCount: 1 }) {
      minimumBidPrice
      uninterruptablePrice
      gpuName
      stockStatus
      minMemory
      minVcpu
    }
  }
}
"""

# Pricing tiers to extract from each GPU type.
# (field_name, commitment_type, cloud_tier)
PRICING_TIERS = [
    ("communityPrice", "on_demand", "community"),
    ("securePrice", "on_demand", "secure"),
    ("communitySpotPrice", "spot", "community"),
    ("secureSpotPrice", "spot", "secure"),
    ("oneWeekPrice", "reserved_1w", None),
    ("oneMonthPrice", "reserved_1m", None),
    ("threeMonthPrice", "reserved_3m", None),
    ("sixMonthPrice", "reserved_6m", None),
]


class RunPodCollector(BaseCollector):
    """Collects GPU pricing data from RunPod's GraphQL API.

    Unlike Vast.ai (a marketplace with individual machine offers), RunPod
    returns one entry per GPU type with fixed pricing tiers. Each GPU type
    produces multiple observations — one per active pricing tier.
    """

    source_name = "runpod"

    async def collect(self) -> list[RawObservationCreate]:
        """Fetch all GPU types and pricing from RunPod."""
        now = self.now_utc()
        gpu_types = await self._fetch_gpu_types()
        observations: list[RawObservationCreate] = []

        for gpu in gpu_types:
            try:
                obs_list = self._parse_gpu_type(gpu, now)
                observations.extend(obs_list)
            except Exception:
                logger.warning(
                    "Failed to parse RunPod GPU type id=%s", gpu.get("id"), exc_info=True
                )

        return observations

    async def _fetch_gpu_types(self) -> list[dict]:
        """Call the RunPod GraphQL API and return GPU type dicts."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                RUNPOD_GRAPHQL_URL,
                json={"query": GPU_TYPES_QUERY},
                headers={"Content-Type": "application/json"},
            )
            response.raise_for_status()
            data = response.json()

        gpu_types = data.get("data", {}).get("gpuTypes", [])
        # Filter out the "unknown" placeholder entry
        gpu_types = [g for g in gpu_types if g.get("id") and g["id"] != "unknown"]
        logger.info("RunPod API returned %d GPU types", len(gpu_types))
        return gpu_types

    @staticmethod
    def _parse_gpu_type(gpu: dict, collected_at) -> list[RawObservationCreate]:
        """Convert a single RunPod GPU type into observations, one per pricing tier.

        A GPU type like "A100 SXM" may have communityPrice, securePrice,
        communitySpotPrice, etc. Each non-null, non-zero price becomes
        a separate raw observation.
        """
        gpu_id = gpu.get("id", "")
        display_name = gpu.get("displayName", gpu_id)
        memory_gb = gpu.get("memoryInGb")
        lowest_price = gpu.get("lowestPrice") or {}

        observations: list[RawObservationCreate] = []

        for field, commitment_type, cloud_tier in PRICING_TIERS:
            price = gpu.get(field)

            # Skip unavailable tiers (null or 0 means not offered)
            if not price or price <= 0:
                continue

            observations.append(
                RawObservationCreate(
                    source="runpod",
                    collected_at=collected_at,
                    raw_payload=gpu,
                    gpu_model_reported=display_name,
                    price_hourly=price,
                    region_reported=None,  # RunPod doesn't expose region per GPU type
                    commitment_type_reported=commitment_type,
                    provider_metadata={
                        "runpod_id": gpu_id,
                        "cloud_tier": cloud_tier,
                        "memory_gb": memory_gb,
                        "manufacturer": gpu.get("manufacturer"),
                        "max_gpu_count": gpu.get("maxGpuCount"),
                        "stock_status": lowest_price.get("stockStatus"),
                        "min_memory": lowest_price.get("minMemory"),
                        "min_vcpu": lowest_price.get("minVcpu"),
                        "community_cloud": gpu.get("communityCloud"),
                        "secure_cloud": gpu.get("secureCloud"),
                    },
                )
            )

        return observations
