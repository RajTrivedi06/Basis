/**
 * Server-side data assembly for the scrollytelling landing (Stage 6.2).
 *
 * The story's narrative copy is server-rendered (design doc §8); these
 * fetchers run in the server component with ISR so every number in the
 * initial HTML is a live value, not a placeholder. Each section degrades
 * independently: a null means "render the range-language fallback", never
 * a stale or invented number (Quarantine Rule).
 */

import type { ExplainabilityArtifact } from "@/lib/mlExplainabilityTypes";
import type {
  FungibilityMatrixResponse,
  OfferListResponse,
  ProviderListResponse,
  BasisDecompositionResponse,
} from "@/lib/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const REVALIDATE_SECONDS = 900;

/** The landing tells one SKU's story; the dashboard covers the rest. */
export const HERO_SKU = "h100_sxm_80gb";

/** Providers whose staleness exceeds this are retired (rule from #53). */
const RETIRED_AFTER_DAYS = 7;

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface HeroBounds {
  /** p5/p95 of the last day's quotes — robust per the C1 spec, so a
   *  single junk listing can never inflate the hook's spread. */
  low: number;
  high: number;
  multiple: number;
  /** Real offers nearest each bound, for the Scene 2 price cards. */
  lowOffer: { provider: string; commitment: string; price: number };
  highOffer: { provider: string; commitment: string; price: number };
  sampleSize: number;
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function computeHeroBounds(offers: OfferListResponse | null): HeroBounds | null {
  const items = offers?.items ?? [];
  const priced = items
    .map((o) => ({
      provider: o.provider,
      commitment: o.commitment_type ?? "unknown",
      price: o.normalized_price_usd_per_hour ?? o.price_usd_per_hour,
    }))
    .filter((o): o is { provider: string; commitment: string; price: number } =>
      typeof o.price === "number" && Number.isFinite(o.price) && o.price > 0
    )
    .sort((a, b) => a.price - b.price);

  // Below this the quantiles are noise, and the hook would be built on a
  // handful of listings — fall back to range language instead.
  if (priced.length < 20) return null;

  const prices = priced.map((o) => o.price);
  const low = quantile(prices, 0.05);
  const high = quantile(prices, 0.95);
  if (low <= 0 || high <= low) return null;

  const nearest = (target: number) =>
    priced.reduce((best, o) =>
      Math.abs(o.price - target) < Math.abs(best.price - target) ? o : best
    );

  return {
    low,
    high,
    multiple: high / low,
    lowOffer: nearest(low),
    highOffer: nearest(high),
    sampleSize: priced.length,
  };
}

export interface StoryData {
  bounds: HeroBounds | null;
  /** Active (non-retired) providers, staleness rule from #53. */
  activeProviders: string[];
  totalOffers: number | null;
  skuCount: number | null;
  decomposition: BasisDecompositionResponse | null;
  artifact: ExplainabilityArtifact | null;
}

export async function getStoryData(): Promise<StoryData> {
  const sinceIso = new Date(Date.now() - 36 * 3600 * 1000).toISOString();

  const [providers, matrix, offers, decomposition, artifact] =
    await Promise.all([
      fetchJson<ProviderListResponse>("/api/providers"),
      fetchJson<FungibilityMatrixResponse>("/api/fungibility-matrix"),
      fetchJson<OfferListResponse>(
        `/api/offers?gpu_sku=${HERO_SKU}&since=${encodeURIComponent(sinceIso)}&page_size=500`
      ),
      fetchJson<BasisDecompositionResponse>(`/api/basis/${HERO_SKU}`),
      fetchJson<ExplainabilityArtifact>("/api/ml/explainability"),
    ]);

  const now = Date.now();
  const activeProviders = (providers?.items ?? [])
    .filter((p) => {
      if (!p.latest_collection) return false;
      const ageDays =
        (now - new Date(p.latest_collection).getTime()) / 86_400_000;
      return ageDays <= RETIRED_AFTER_DAYS;
    })
    .map((p) => p.provider);

  const totalOffers =
    providers?.items.reduce((s, p) => s + p.offer_count, 0) ?? null;

  return {
    bounds: computeHeroBounds(offers),
    activeProviders,
    totalOffers,
    skuCount: matrix?.items.length ?? null,
    decomposition,
    artifact,
  };
}

/** "Jul 31" from an ISO timestamp, UTC, for the dated-anchor lines (A6). */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
