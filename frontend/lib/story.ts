/**
 * Server-side data assembly for the scrollytelling landing (Stage 6.2).
 *
 * The story's narrative copy is server-rendered (design doc §8); these
 * fetchers run in the server component with ISR so every number in the
 * initial HTML is a live value, not a placeholder. Each section degrades
 * independently: a null means "render the range-language fallback", never
 * a stale or invented number (Quarantine Rule).
 */

import { buildQuoteExhibit, type QuoteExhibit } from "@/lib/fileCopy";
import type { ExplainabilityArtifact } from "@/lib/mlExplainabilityTypes";
import type {
  BasisDecompositionResponse,
  BasisTimeseriesResponse,
  FungibilityMatrixResponse,
  OfferListResponse,
  ProviderListResponse,
} from "@/lib/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const REVALIDATE_SECONDS = 900;
/** Bound SSG: an unset/unreachable API must degrade to null, not hang
 *  `next build` until the 60s static-generation timeout (CI failure on #71). */
const FETCH_TIMEOUT_MS = 5_000;

/** The landing tells one SKU's story; the dashboard covers the rest. */
export const HERO_SKU = "h100_sxm_80gb";

/** Providers whose staleness exceeds this are retired (rule from #53). */
const RETIRED_AFTER_DAYS = 7;

/**
 * Azure and GCP publish administered list catalogs: one posted price per
 * instance type, revised rarely. Excluding them leaves the market-priced
 * segments the finding speaks about, which is the framing design doc §5
 * row 6 rules for the accounting scene and the framing the findings hero
 * already uses. The exclusion is never silent — the sheet prints it.
 */
export const CATALOG_PROVIDERS = ["azure", "gcp"] as const;

/** The collection rhythm, fixed by the cron schedule, not by the data. */
export const COLLECTIONS_PER_DAY = 2;

async function fetchJson<T>(path: string): Promise<T | null> {
  // Production builds emit no /api rewrite (see next.config.ts). Relative
  // fetches during SSG have nowhere to go and hang without a base URL.
  if (!BASE_URL) return null;
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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
  lowOffer: {
    provider: string;
    commitment: string;
    price: number;
    region: string | null;
  };
  highOffer: {
    provider: string;
    commitment: string;
    price: number;
    region: string | null;
  };
  sampleSize: number;
  /**
   * Whether the two illustrative offers come from different sellers. The
   * hook's "one cloud, and another" claim is only true when they do, so the
   * copy reads this rather than assuming it: on a day when the spread lives
   * inside a single catalog, the page says that instead.
   */
  crossProvider: boolean;
}

interface PricedOffer {
  provider: string;
  commitment: string;
  price: number;
  region: string | null;
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Exported for test: the cross-provider rule is a truth rule, not a detail. */
export function computeHeroBounds(
  offers: OfferListResponse | null
): HeroBounds | null {
  const items = offers?.items ?? [];
  const priced = items
    .map((o) => ({
      provider: o.provider,
      commitment: o.commitment_type ?? "unknown",
      price: o.normalized_price_usd_per_hour ?? o.price_usd_per_hour,
      region: o.region_country,
    }))
    .filter(
      (o): o is PricedOffer =>
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

  const nearest = (target: number, pool: PricedOffer[]) =>
    pool.reduce((best, o) =>
      Math.abs(o.price - target) < Math.abs(best.price - target) ? o : best
    );

  const lowOffer = nearest(low, priced);

  // Prefer a different seller for the dear end, so the two cards illustrate
  // the claim the page actually makes. Only if that seller has a quote within
  // a quarter of p95 — the cards must stay offers "at or near the bound", not
  // a convenient pick from somewhere else on the axis.
  const elsewhere = priced.filter((o) => o.provider !== lowOffer.provider);
  const candidate = elsewhere.length > 0 ? nearest(high, elsewhere) : null;
  const withinTolerance =
    candidate !== null &&
    Math.abs(Math.log(candidate.price) - Math.log(high)) <= Math.log(1.25);
  const highOffer = withinTolerance ? candidate : nearest(high, priced);

  return {
    low,
    high,
    multiple: high / low,
    lowOffer,
    highOffer,
    sampleSize: priced.length,
    crossProvider: highOffer.provider !== lowOffer.provider,
  };
}

/**
 * Live range for the week-motion line (§7). The truth patch's frozen
 * "~20–61%" is kept as the sentence's shape, but the figures come from the
 * series so the claim can never go stale under a moving market.
 */
export interface ResidualRange {
  minPct: number;
  maxPct: number;
  days: number;
}

function computeResidualRange(
  ts: BasisTimeseriesResponse | null
): ResidualRange | null {
  const points = ts?.points ?? [];
  const shares = points
    .map((p) => p.pct_residual)
    .filter((v) => typeof v === "number" && Number.isFinite(v));
  if (shares.length < 5) return null;
  return {
    minPct: Math.min(...shares),
    maxPct: Math.max(...shares),
    days: shares.length,
  };
}

export interface StoryData {
  bounds: HeroBounds | null;
  /** Active (non-retired) providers, staleness rule from #53. */
  activeProviders: string[];
  totalOffers: number | null;
  skuCount: number | null;
  /**
   * The accounting scene's decomposition, market-priced (list catalogs
   * excluded) per design doc §5 row 6.
   */
  decomposition: BasisDecompositionResponse | null;
  residualRange: ResidualRange | null;
  /** One real collection day of quotes for the hero SKU. */
  quotes: QuoteExhibit | null;
  artifact: ExplainabilityArtifact | null;
  /** Newest collection timestamp across active providers. */
  collectedAt: string | null;
}

function isoDay(iso: string): string {
  return iso.slice(0, 10);
}

export async function getStoryData(): Promise<StoryData> {
  const sinceIso = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
  const exclusion = CATALOG_PROVIDERS.join(",");

  const [providers, matrix, offers, decomposition, timeseries, artifact] =
    await Promise.all([
      fetchJson<ProviderListResponse>("/api/providers"),
      fetchJson<FungibilityMatrixResponse>("/api/fungibility-matrix"),
      fetchJson<OfferListResponse>(
        `/api/offers?gpu_sku=${HERO_SKU}&since=${encodeURIComponent(sinceIso)}&page_size=500`
      ),
      fetchJson<BasisDecompositionResponse>(
        `/api/basis/${HERO_SKU}?exclude_providers=${exclusion}`
      ),
      fetchJson<BasisTimeseriesResponse>(
        `/api/basis/${HERO_SKU}/timeseries?exclude_providers=${exclusion}`
      ),
      fetchJson<ExplainabilityArtifact>("/api/ml/explainability"),
    ]);

  const now = Date.now();
  const liveProviders = (providers?.items ?? []).filter((p) => {
    if (!p.latest_collection) return false;
    const ageDays = (now - new Date(p.latest_collection).getTime()) / 86_400_000;
    return ageDays <= RETIRED_AFTER_DAYS;
  });

  const activeProviders = liveProviders.map((p) => p.provider);

  const collectedAt =
    liveProviders.length > 0
      ? liveProviders
          .map((p) => p.latest_collection as string)
          .reduce((a, b) => (a > b ? a : b))
      : null;

  const totalOffers =
    providers?.items.reduce((s, p) => s + p.offer_count, 0) ?? null;

  // The quotes exhibit is one collection day, so it needs that day whole
  // rather than the newest 500 rows of a 36-hour window — a second, narrower
  // request keyed on the day the collectors last ran.
  const exhibitDay = collectedAt !== null ? isoDay(collectedAt) : null;
  const dayOffers = exhibitDay
    ? await fetchJson<OfferListResponse>(
        `/api/offers?gpu_sku=${HERO_SKU}&since=${exhibitDay}T00:00:00Z&page_size=500`
      )
    : null;

  // One population for the whole page: the hook's p5/p95, the two price
  // cards, and the lanes exhibit all read the same day of quotes, so the
  // hairlines land where the hook says they do and "n" means one thing.
  const exhibitSource = dayOffers ?? offers;
  const quotes = buildQuoteExhibit(
    exhibitSource?.items ?? [],
    exhibitSource?.total ?? null
  );

  return {
    bounds: computeHeroBounds(exhibitSource),
    activeProviders,
    totalOffers,
    skuCount: matrix?.items.length ?? null,
    decomposition,
    residualRange: computeResidualRange(timeseries),
    quotes,
    artifact,
    collectedAt,
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

/** "Aug 5, 20:04 UTC" for the file-copy slates. */
export function stampDate(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
  return `${day} · ${time} UTC`;
}
