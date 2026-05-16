/**
 * API client for the Basis backend.
 *
 * In development, Next.js rewrites /api/* requests to the FastAPI backend
 * via next.config.ts, so relative paths work without CORS.
 */

import type {
  BasisDecompositionResponse,
  BasisTimeseriesResponse,
  DecompositionObservationsResponse,
  DispersionResponse,
  FungibilityMatrixResponse,
  GpuSkuListResponse,
  HealthResponse,
  OfferListResponse,
  ProviderListResponse,
  RawObservationDetail,
  RawObservationExplainResponse,
} from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    let detail: string;
    try {
      const body = await res.json();
      detail = typeof body?.detail === "string" ? body.detail : res.statusText;
    } catch {
      detail = res.statusText;
    }
    throw new Error(`API ${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

function qs(params?: Record<string, string | number | undefined | null>): string {
  if (!params) return "";
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );
  if (entries.length === 0) return "";
  const search = new URLSearchParams(
    entries.map(([k, v]) => [k, String(v)]) as [string, string][]
  );
  return `?${search.toString()}`;
}

export async function getHealth(): Promise<HealthResponse> {
  return fetchApi<HealthResponse>("/health");
}

export async function getOffers(
  params?: Record<string, string | number>
): Promise<OfferListResponse> {
  return fetchApi<OfferListResponse>(`/api/offers${qs(params)}`);
}

export async function getDispersion(
  gpuSku: string,
  params?: { since?: string; until?: string; provider?: string }
): Promise<DispersionResponse> {
  return fetchApi<DispersionResponse>(
    `/api/dispersion/${encodeURIComponent(gpuSku)}${qs(params)}`
  );
}

export async function getBasisDecomposition(
  gpuSku: string,
  params?: { date?: string }
): Promise<BasisDecompositionResponse> {
  return fetchApi<BasisDecompositionResponse>(
    `/api/basis/${encodeURIComponent(gpuSku)}${qs(params)}`
  );
}

export async function getBasisTimeseries(
  gpuSku: string,
  params?: {
    since?: string;
    until?: string;
    /**
     * Provider names (canonical, lowercase) to exclude from the
     * decomposition. Sent as the comma-separated `exclude_providers`
     * query param, which the backend honours by recomputing the
     * decomposition on demand instead of reading the precomputed table.
     */
    excludeProviders?: string[];
  }
): Promise<BasisTimeseriesResponse> {
  const query: Record<string, string | undefined> = {
    since: params?.since,
    until: params?.until,
  };
  if (params?.excludeProviders && params.excludeProviders.length > 0) {
    query.exclude_providers = params.excludeProviders.join(",");
  }
  return fetchApi<BasisTimeseriesResponse>(
    `/api/basis/${encodeURIComponent(gpuSku)}/timeseries${qs(query)}`
  );
}

export async function getProviders(): Promise<ProviderListResponse> {
  return fetchApi<ProviderListResponse>("/api/providers");
}

export async function getGpuSkus(): Promise<GpuSkuListResponse> {
  return fetchApi<GpuSkuListResponse>("/api/gpu-skus");
}

export async function getFungibilityMatrix(): Promise<FungibilityMatrixResponse> {
  return fetchApi<FungibilityMatrixResponse>("/api/fungibility-matrix");
}

export async function getDecompositionObservations(
  gpuSku: string,
  params?: { date?: string }
): Promise<DecompositionObservationsResponse> {
  return fetchApi<DecompositionObservationsResponse>(
    `/api/decomposition/${encodeURIComponent(gpuSku)}/observations${qs(params)}`
  );
}

export async function getRawObservation(
  id: number
): Promise<RawObservationDetail> {
  return fetchApi<RawObservationDetail>(`/api/raw-observation/${id}`);
}

export async function getRawObservationExplain(
  id: number
): Promise<RawObservationExplainResponse> {
  return fetchApi<RawObservationExplainResponse>(
    `/api/raw-observation/${id}/explain`
  );
}
