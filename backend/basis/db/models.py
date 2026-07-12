"""SQLAlchemy ORM models for the Basis database.

Four tables matching the schema in Basis_Project_Proposal.md section 5.3:
- RawObservation: immutable raw API responses (write-once, never modify)
- CanonicalOffer: normalized projection with standardized fields
- DailyAggregate: materialized daily metrics for fast dashboard queries
- BasisDecomposition: stored variance attribution results
"""

import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from basis.db.base import Base


class RawObservation(Base):
    """Immutable record of a single price observation from a provider.

    Stores the full API response as JSONB. Never modified after insert.
    """

    __tablename__ = "raw_observations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    collected_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    raw_payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    gpu_model_reported: Mapped[str] = mapped_column(String(200), nullable=False)
    price_hourly: Mapped[float] = mapped_column(Float, nullable=False)
    region_reported: Mapped[str | None] = mapped_column(String(200), nullable=True)
    commitment_type_reported: Mapped[str | None] = mapped_column(String(100), nullable=True)
    provider_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    __table_args__ = (
        Index("ix_raw_obs_collected_gpu_provider", "collected_at", "gpu_model_reported", "source"),
    )


class CanonicalOffer(Base):
    """Normalized offer derived from a raw observation.

    Links back to the raw observation via foreign key. Can be regenerated
    if normalization logic changes.
    """

    __tablename__ = "canonical_offers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    raw_observation_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("raw_observations.id"), nullable=False
    )
    collected_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    gpu_sku_canonical: Mapped[str] = mapped_column(String(100), nullable=False)
    gpu_variant: Mapped[str | None] = mapped_column(String(50), nullable=True)
    vram_gb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    region_country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    region_state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    region_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    commitment_type: Mapped[str] = mapped_column(String(50), nullable=False)
    vcpus_bundled: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ram_gb_bundled: Mapped[float | None] = mapped_column(Float, nullable=True)
    storage_gb_bundled: Mapped[float | None] = mapped_column(Float, nullable=True)
    networking_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    verification_tier: Mapped[str | None] = mapped_column(String(50), nullable=True)
    price_usd_per_hour: Mapped[float] = mapped_column(Float, nullable=False)
    normalized_price_usd_per_hour: Mapped[float | None] = mapped_column(Float, nullable=True)

    __table_args__ = (
        Index("ix_canonical_collected_gpu_provider", "collected_at", "gpu_sku_canonical", "provider"),
        # Backs the normalization anti-join (find raw rows without a canonical
        # offer). A FK does not auto-create an index in Postgres; without this
        # the NOT EXISTS / NOT IN check full-scans canonical_offers.
        Index("ix_canonical_raw_obs_id", "raw_observation_id"),
    )


class DailyAggregate(Base):
    """Materialized daily snapshot of pricing metrics.

    Precomputed for fast dashboard queries. Recomputed daily.
    """

    __tablename__ = "daily_aggregates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    date: Mapped[datetime.date] = mapped_column(nullable=False)
    gpu_sku: Mapped[str] = mapped_column(String(100), nullable=False)
    provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    region: Mapped[str | None] = mapped_column(String(100), nullable=True)
    observation_count: Mapped[int] = mapped_column(Integer, nullable=False)
    median_price: Mapped[float] = mapped_column(Float, nullable=False)
    p25_price: Mapped[float] = mapped_column(Float, nullable=False)
    p75_price: Mapped[float] = mapped_column(Float, nullable=False)
    normalized_median_price: Mapped[float | None] = mapped_column(Float, nullable=True)

    __table_args__ = (
        Index("ix_daily_agg_date_gpu", "date", "gpu_sku"),
    )


class BasisDecomposition(Base):
    """Stored results of variance decomposition analysis.

    Each row represents the decomposition for a given date and GPU SKU,
    attributing total variance to observable factors and residual.
    """

    __tablename__ = "basis_decomposition"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    date: Mapped[datetime.date] = mapped_column(nullable=False)
    gpu_sku: Mapped[str] = mapped_column(String(100), nullable=False)
    total_variance: Mapped[float] = mapped_column(Float, nullable=False)
    variance_from_region: Mapped[float] = mapped_column(Float, nullable=False)
    variance_from_commitment: Mapped[float] = mapped_column(Float, nullable=False)
    variance_from_bundle: Mapped[float] = mapped_column(Float, nullable=False)
    variance_from_provider: Mapped[float] = mapped_column(Float, nullable=False)
    residual_variance: Mapped[float] = mapped_column(Float, nullable=False)

    __table_args__ = (
        Index("ix_basis_decomp_date_gpu", "date", "gpu_sku"),
    )
