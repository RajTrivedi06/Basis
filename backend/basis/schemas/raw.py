"""Pydantic models for raw observation data.

These schemas validate data coming from collectors before it's persisted
to the raw_observations table.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class RawObservationCreate(BaseModel):
    """Schema for creating a new raw observation."""

    source: str = Field(..., description="Provider identifier (e.g., 'vast', 'runpod', 'aws_spot')")
    collected_at: datetime = Field(..., description="UTC timestamp of when the data was collected")
    raw_payload: dict[str, Any] = Field(..., description="Full API response stored as JSONB")
    gpu_model_reported: str = Field(..., description="GPU model as reported by the provider")
    price_hourly: float = Field(..., gt=0, description="Price in USD per hour as reported")
    region_reported: str | None = Field(None, description="Region as reported by the provider")
    commitment_type_reported: str | None = Field(None, description="Commitment type as reported")
    provider_metadata: dict[str, Any] | None = Field(None, description="Additional provider data")


class RawObservationRead(RawObservationCreate):
    """Schema for reading a raw observation from the database."""

    id: int

    model_config = {"from_attributes": True}
