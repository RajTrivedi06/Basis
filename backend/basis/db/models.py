"""SQLAlchemy ORM models for the Basis database.

Core pricing tables matching Basis_Project_Proposal.md section 5.3, plus:
- RawObservation: immutable raw API responses (write-once, never modify)
- CanonicalOffer: normalized projection with standardized fields
- DailyAggregate: materialized daily metrics for fast dashboard queries
- BasisDecomposition: stored variance attribution results
- DocChunk: embedded documentation chunks for the Ask Basis RAG layer
"""

import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Computed,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column

from basis.db.base import Base


class RawObservation(Base):
    """Immutable record of a single price observation from a provider.

    Stores the full API response as JSONB. Never modified after insert.
    """

    __tablename__ = "raw_observations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    collected_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    raw_payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    gpu_model_reported: Mapped[str] = mapped_column(String(200), nullable=False)
    price_hourly: Mapped[float] = mapped_column(Float, nullable=False)
    region_reported: Mapped[str | None] = mapped_column(String(200), nullable=True)
    commitment_type_reported: Mapped[str | None] = mapped_column(String(100), nullable=True)
    provider_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    __table_args__ = (
        Index("ix_raw_obs_collected_gpu_provider", "collected_at", "gpu_model_reported", "source"),
        # `> 0` alone admits +Infinity and NaN in PostgreSQL (both sort above
        # every finite value); `< 'Infinity'` excludes both. Schema-level
        # allow_inf_nan=False rejects them earlier; this is the last line.
        CheckConstraint(
            "price_hourly > 0 AND price_hourly < 'Infinity'::float8",
            name="ck_raw_obs_price_finite",
        ),
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
    collected_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
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
        Index(
            "ix_canonical_collected_gpu_provider", "collected_at", "gpu_sku_canonical", "provider"
        ),
        # Backs the normalization anti-join (find raw rows without a canonical
        # offer). A FK does not auto-create an index in Postgres; without this
        # the NOT EXISTS / NOT IN check full-scans canonical_offers.
        Index("ix_canonical_raw_obs_id", "raw_observation_id"),
        CheckConstraint(
            "price_usd_per_hour > 0 AND price_usd_per_hour < 'Infinity'::float8",
            name="ck_canonical_price_finite",
        ),
        CheckConstraint(
            "normalized_price_usd_per_hour IS NULL OR "
            "(normalized_price_usd_per_hour > 0 "
            "AND normalized_price_usd_per_hour < 'Infinity'::float8)",
            name="ck_canonical_norm_price_finite",
        ),
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
    # Which admitted population this row was computed from (collection window,
    # completeness state, admissibility rules). NULL = legacy, pre-versioning.
    population_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    __table_args__ = (Index("ix_daily_agg_date_gpu", "date", "gpu_sku"),)


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
    # The estimand. "v1-joint-cell" is the sequential joint-cell partition the
    # analytics have always computed; an additive nested least-squares variant
    # lands as "v2-additive". Historical rows are never overwritten across
    # versions — a version is a new row set.
    method_version: Mapped[str] = mapped_column(
        String(40), nullable=False, server_default="v1-joint-cell"
    )
    population_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    __table_args__ = (
        Index("ix_basis_decomp_date_gpu", "date", "gpu_sku"),
        Index("ix_basis_decomp_method", "method_version"),
    )


class CollectionHealth(Base):
    """Completeness verdict for one commitment query of one collection run.

    Written by run_collect.py from the collector's health records. The volume
    alert reads the latest row per (source, commitment): a provider whose
    latest row is not exhaustive stays alerting until a later exhaustive row
    exists — the persistent, non-adaptive failure state the 2026-09-06 review
    asked for.
    """

    __tablename__ = "collection_health"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    collected_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    commitment_type: Mapped[str] = mapped_column(String(50), nullable=False)
    cap: Mapped[int] = mapped_column(Integer, nullable=False)
    bands_total: Mapped[int] = mapped_column(Integer, nullable=False)
    bands_incomplete: Mapped[int] = mapped_column(Integer, nullable=False)
    offers_returned: Mapped[int] = mapped_column(Integer, nullable=False)
    offers_unique: Mapped[int] = mapped_column(Integer, nullable=False)
    exhaustive: Mapped[bool] = mapped_column(Boolean, nullable=False)
    desc_check_missing: Mapped[int | None] = mapped_column(Integer, nullable=True)
    probe_missing: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    __table_args__ = (
        Index("ix_collection_health_source_ts", "source", "commitment_type", "collected_at"),
    )


class DocChunk(Base):
    """Embedded documentation chunk used by the Ask Basis RAG layer."""

    __tablename__ = "doc_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_path: Mapped[str] = mapped_column(String, nullable=False)
    heading: Mapped[str | None] = mapped_column(String, nullable=True)
    chunk_text: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float]] = mapped_column(Vector(1536), nullable=False)
    token_count: Mapped[int] = mapped_column(Integer, nullable=False)
    chunk_tsv: Mapped[str] = mapped_column(
        TSVECTOR,
        Computed("to_tsvector('english', chunk_text)", persisted=True),
        nullable=False,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        Index("ix_doc_chunks_source_path", "source_path"),
        Index(
            "ix_doc_chunks_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
        Index("ix_doc_chunks_chunk_tsv", "chunk_tsv", postgresql_using="gin"),
    )


class AskDailyUsage(Base):
    """Global Ask Basis question count keyed by UTC date."""

    __tablename__ = "ask_daily_usage"

    day: Mapped[datetime.date] = mapped_column(primary_key=True)
    question_count: Mapped[int] = mapped_column(Integer, nullable=False)
