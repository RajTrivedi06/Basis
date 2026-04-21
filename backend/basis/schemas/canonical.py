"""Pydantic models for canonical (normalized) offer data.

These schemas represent the standardized form of GPU offers after
normalization from raw observations.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class CanonicalOfferCreate(BaseModel):
    """Schema for creating a canonical offer from a raw observation."""

    raw_observation_id: int
    collected_at: datetime
    gpu_sku_canonical: str = Field(..., description="Standardized GPU SKU (e.g., 'h100_sxm_80gb')")
    gpu_variant: str | None = Field(None, description="Variant: 'sxm' or 'pcie'")
    vram_gb: int | None = None
    region_country: str | None = None
    region_state: str | None = None
    region_city: str | None = None
    provider: str
    commitment_type: str = Field(
        ..., description="One of: on_demand, spot, reserved_1m, reserved_6m, reserved_1y, reserved_3y"
    )
    vcpus_bundled: int | None = None
    ram_gb_bundled: float | None = None
    storage_gb_bundled: float | None = None
    networking_type: str | None = None
    verification_tier: str | None = None
    price_usd_per_hour: float = Field(..., gt=0, description="Raw price in USD/GPU/hour")
    normalized_price_usd_per_hour: float | None = Field(
        None, description="Price after adjusting for observable factors"
    )


class CanonicalOfferRead(CanonicalOfferCreate):
    """Schema for reading a canonical offer from the database."""

    id: int

    model_config = {"from_attributes": True}
