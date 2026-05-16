"""Pydantic models for API request/response payloads.

These schemas define the contract between the FastAPI backend and the
Next.js frontend.
"""

from datetime import date, datetime

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Response from the health check endpoint."""

    status: str
    version: str
    environment: str


class OfferSummary(BaseModel):
    """Summary of a canonical offer for API responses."""

    id: int
    collected_at: datetime
    gpu_sku: str
    provider: str
    region_country: str | None
    commitment_type: str
    price_usd_per_hour: float
    normalized_price_usd_per_hour: float | None


class OfferListResponse(BaseModel):
    """Paginated list of offers."""

    items: list[OfferSummary]
    total: int
    page: int
    page_size: int


class DispersionPoint(BaseModel):
    """Single data point in a dispersion time series."""

    date: date
    gpu_sku: str
    observation_count: int
    median_price: float
    p25_price: float
    p75_price: float
    iqr: float
    coefficient_of_variation: float | None


class DispersionResponse(BaseModel):
    """Dispersion metrics over a time range."""

    gpu_sku: str
    points: list[DispersionPoint]


class BasisDecompositionResponse(BaseModel):
    """Variance decomposition for a given date and GPU SKU."""

    date: date
    gpu_sku: str
    total_variance: float
    variance_from_region: float
    variance_from_commitment: float
    variance_from_bundle: float
    variance_from_provider: float
    residual_variance: float
    pct_explained: float
    pct_residual: float


# Wrapped (not bare list) so we can attach optional summary fields later
# (e.g. median_residual_share, iqr, outlier_dates) without breaking clients.
class BasisTimeseriesResponse(BaseModel):
    """Variance decompositions for a GPU SKU across a date range."""

    gpu_sku: str
    points: list[BasisDecompositionResponse]


class ProviderSummary(BaseModel):
    """Per-provider summary of coverage and pricing."""

    provider: str
    offer_count: int
    distinct_skus: int
    latest_collection: datetime | None
    median_deviation_pct: float | None   # provider median vs market median (null if <2 providers on latest date)


class ProviderListResponse(BaseModel):
    """All providers Basis collects from."""

    items: list[ProviderSummary]


class GpuSkuSummary(BaseModel):
    """Per-canonical-SKU summary."""

    gpu_sku: str
    gpu_variant: str | None
    vram_gb: int | None
    offer_count: int
    provider_count: int
    latest_median_price: float | None


class GpuSkuListResponse(BaseModel):
    """All canonical SKUs currently observed."""

    items: list[GpuSkuSummary]


class FungibilityMatrixRow(BaseModel):
    """One row of the fungibility matrix: a canonical SKU at its latest observed date."""

    gpu_sku: str
    latest_date: date
    median_price: float
    observation_count: int
    provider_count: int
    total_variance: float | None
    residual_variance: float | None
    pct_residual: float | None


class FungibilityMatrixResponse(BaseModel):
    """One row per canonical SKU for the fungibility matrix."""

    items: list[FungibilityMatrixRow]


# --- Provenance drilldown (v2 Phase B) ---


class DecompositionObservation(BaseModel):
    """A canonical offer that contributed to a given (gpu_sku, date) decomposition bucket."""

    canonical_offer_id: int
    raw_observation_id: int
    collected_at: datetime
    provider: str
    price_usd_per_hour: float
    commitment_type: str
    region_country: str | None
    region_state: str | None
    region_city: str | None
    vcpus_bundled: int | None
    ram_gb_bundled: float | None
    storage_gb_bundled: float | None
    verification_tier: str | None


class DecompositionObservationsResponse(BaseModel):
    """Canonical offers for a (gpu_sku, date) decomposition bucket."""

    gpu_sku: str
    date: date
    items: list[DecompositionObservation]


class RawObservationDetail(BaseModel):
    """Raw observation row with the full provider payload."""

    id: int
    source: str
    collected_at: datetime
    gpu_model_reported: str
    price_hourly: float
    region_reported: str | None
    commitment_type_reported: str | None
    provider_metadata: dict | None
    raw_payload: dict


class GpuCanonicalizationExplanationSchema(BaseModel):
    reported_name: str
    matched: bool
    canonical_sku: str | None
    gpu_variant: str | None
    vram_gb: int | None
    rules: list[str]


class CommitmentCanonicalizationExplanationSchema(BaseModel):
    reported_type: str | None
    canonical_type: str
    rule: str
    matched_key: str | None


class RegionNormalizationExplanationSchema(BaseModel):
    source: str
    region_reported: str | None
    branch: str
    country: str | None
    state: str | None
    city: str | None
    trail: list[str]


class BundleFieldProvenanceSchema(BaseModel):
    canonical_field: str
    source_field: str | None
    source_value: object = None
    result: object = None
    transformation: str | None


class BundleExtractionExplanationSchema(BaseModel):
    source: str
    branch: str
    vcpus: int | None
    ram_gb: float | None
    storage_gb: float | None
    networking_type: str | None
    verification_tier: str | None
    fields: list[BundleFieldProvenanceSchema]


class RawObservationExplainResponse(BaseModel):
    """Composed attribution across all four normalization modules for one raw row."""

    raw_observation_id: int
    source: str
    gpu: GpuCanonicalizationExplanationSchema
    commitment: CommitmentCanonicalizationExplanationSchema
    region: RegionNormalizationExplanationSchema
    bundle: BundleExtractionExplanationSchema
