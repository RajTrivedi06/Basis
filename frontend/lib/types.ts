/**
 * TypeScript types matching the backend Pydantic API schemas.
 *
 * Keep these in sync with backend/basis/schemas/api.py.
 */

export interface HealthResponse {
  status: string;
  version: string;
  environment: string;
}

export interface OfferSummary {
  id: number;
  collected_at: string;
  gpu_sku: string;
  provider: string;
  region_country: string | null;
  commitment_type: string;
  price_usd_per_hour: number;
  normalized_price_usd_per_hour: number | null;
}

export interface OfferListResponse {
  items: OfferSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface DispersionPoint {
  date: string;
  gpu_sku: string;
  observation_count: number;
  median_price: number;
  p25_price: number;
  p75_price: number;
  iqr: number;
  coefficient_of_variation: number | null;
}

export interface DispersionResponse {
  gpu_sku: string;
  points: DispersionPoint[];
}

export interface BasisDecompositionResponse {
  date: string;
  gpu_sku: string;
  total_variance: number;
  variance_from_region: number;
  variance_from_commitment: number;
  variance_from_bundle: number;
  variance_from_provider: number;
  residual_variance: number;
  pct_explained: number;
  pct_residual: number;
}

export interface BasisTimeseriesResponse {
  gpu_sku: string;
  points: BasisDecompositionResponse[];
}

export interface ProviderSummary {
  provider: string;
  offer_count: number;
  distinct_skus: number;
  latest_collection: string | null;
  median_deviation_pct: number | null;
}

export interface ProviderListResponse {
  items: ProviderSummary[];
}

export interface GpuSkuSummary {
  gpu_sku: string;
  gpu_variant: string | null;
  vram_gb: number | null;
  offer_count: number;
  provider_count: number;
  latest_median_price: number | null;
}

export interface GpuSkuListResponse {
  items: GpuSkuSummary[];
}

export interface FungibilityMatrixRow {
  gpu_sku: string;
  latest_date: string;
  median_price: number;
  observation_count: number;
  provider_count: number;
  total_variance: number | null;
  residual_variance: number | null;
  pct_residual: number | null;
}

export interface FungibilityMatrixResponse {
  items: FungibilityMatrixRow[];
}

// --- Provenance drilldown (v2 Phase B) ---

export interface DecompositionObservation {
  canonical_offer_id: number;
  raw_observation_id: number;
  collected_at: string;
  provider: string;
  price_usd_per_hour: number;
  commitment_type: string;
  region_country: string | null;
  region_state: string | null;
  region_city: string | null;
  vcpus_bundled: number | null;
  ram_gb_bundled: number | null;
  storage_gb_bundled: number | null;
  verification_tier: string | null;
}

export interface DecompositionObservationsResponse {
  gpu_sku: string;
  date: string;
  items: DecompositionObservation[];
}

export interface RawObservationDetail {
  id: number;
  source: string;
  collected_at: string;
  gpu_model_reported: string;
  price_hourly: number;
  region_reported: string | null;
  commitment_type_reported: string | null;
  provider_metadata: Record<string, unknown> | null;
  raw_payload: Record<string, unknown>;
}

export interface GpuCanonicalizationExplanation {
  reported_name: string;
  matched: boolean;
  canonical_sku: string | null;
  gpu_variant: string | null;
  vram_gb: number | null;
  rules: string[];
}

export interface CommitmentCanonicalizationExplanation {
  reported_type: string | null;
  canonical_type: string;
  rule: string;
  matched_key: string | null;
}

export interface RegionNormalizationExplanation {
  source: string;
  region_reported: string | null;
  branch: string;
  country: string | null;
  state: string | null;
  city: string | null;
  trail: string[];
}

export interface BundleFieldProvenance {
  canonical_field: string;
  source_field: string | null;
  source_value: unknown;
  result: unknown;
  transformation: string | null;
}

export interface BundleExtractionExplanation {
  source: string;
  branch: string;
  vcpus: number | null;
  ram_gb: number | null;
  storage_gb: number | null;
  networking_type: string | null;
  verification_tier: string | null;
  fields: BundleFieldProvenance[];
}

export interface RawObservationExplainResponse {
  raw_observation_id: number;
  source: string;
  gpu: GpuCanonicalizationExplanation;
  commitment: CommitmentCanonicalizationExplanation;
  region: RegionNormalizationExplanation;
  bundle: BundleExtractionExplanation;
}
