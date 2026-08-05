/**
 * Pure geometry and formatting for the landing's file-copy exhibits.
 *
 * Everything here is deterministic and data-driven: dot positions come from
 * real quoted prices on a log axis, lane jitter is hashed from the offer id
 * (never random, so server HTML and client hydration agree), and the axis
 * bounds are derived from the day's own quotes rather than fixed. Nothing in
 * this file invents a number — the Quarantine Rule reaches the geometry too,
 * so a thin day renders a thin exhibit instead of a padded one.
 */

import type { OfferSummary } from "@/lib/types";

/** Feet of "footage" the ribbon counts across the whole scroll. */
export const REEL_LENGTH_FEET = 1187;

/** Dots below this per provider still get a lane; below this in total, no exhibit. */
export const MIN_QUOTES_FOR_EXHIBIT = 12;

const WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
];

/**
 * "Fifteen times apart." The hook states the spread in words, so the sentence
 * reads as a sentence; the exact figures sit in the slate beneath it. Above
 * twenty, or on a fractional multiple below two, digits are clearer.
 */
export function multipleWord(multiple: number): string {
  if (!Number.isFinite(multiple) || multiple <= 0) return "";
  const rounded = Math.round(multiple);
  if (rounded < 2) return multiple.toFixed(1);
  if (rounded > 20) return String(rounded);
  return WORDS[rounded];
}

export function titleCase(word: string): string {
  return word.length === 0 ? word : word[0].toUpperCase() + word.slice(1);
}

/** Deterministic 0–1 from an integer id. Same value on server and client. */
export function hashUnit(id: number): number {
  let x = Math.abs(Math.trunc(id)) + 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  x = x ^ (x >>> 15);
  return (x >>> 0) / 4294967296;
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Position of a price on a log axis, 0 at `lo`, 1 at `hi`. */
export function logPosition(price: number, lo: number, hi: number): number {
  if (!(price > 0) || !(lo > 0) || !(hi > lo)) return 0;
  return clamp01((Math.log(price) - Math.log(lo)) / (Math.log(hi) - Math.log(lo)));
}

/**
 * Axis bounds a little outside the data, snapped to readable values so the
 * ticks are round numbers rather than the day's exact extremes.
 */
export function axisBounds(prices: number[]): { lo: number; hi: number } | null {
  const positive = prices.filter((p) => Number.isFinite(p) && p > 0);
  if (positive.length === 0) return null;
  const min = Math.min(...positive);
  const max = Math.max(...positive);
  const snapDown = (v: number) => {
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    return Math.max(0.01, Math.floor((v / mag) * 2) / 2 * mag);
  };
  const snapUp = (v: number) => {
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    return Math.ceil((v / mag) * 2) / 2 * mag;
  };
  const lo = snapDown(min * 0.92);
  const hi = snapUp(max * 1.08);
  if (!(hi > lo)) return null;
  return { lo, hi };
}

/** Round tick prices inside the axis, for the rule beneath the lanes. */
export function axisTicks(lo: number, hi: number): number[] {
  const candidates = [
    0.05, 0.1, 0.25, 0.5, 1, 2, 3, 5, 8, 10, 15, 20, 30, 50, 80, 100,
  ];
  const inside = candidates.filter((c) => c > lo * 1.02 && c < hi * 0.98);
  // Keep at most four so the rule stays quiet at narrow widths.
  if (inside.length <= 4) return inside;
  const step = (inside.length - 1) / 3;
  return [0, 1, 2, 3].map((i) => inside[Math.round(i * step)]);
}

export interface QuoteDot {
  id: number;
  price: number;
  provider: string;
  commitment: string;
  region: string | null;
  collectedAt: string;
  /** 0–1 along the log price axis. */
  x: number;
  /** 0–1 across the lane's own height, hashed from the id. */
  y: number;
}

export interface QuoteLane {
  provider: string;
  dots: QuoteDot[];
  median: number;
  low: number;
  high: number;
}

export interface QuoteExhibit {
  lanes: QuoteLane[];
  lo: number;
  hi: number;
  ticks: number[];
  /** Quotes actually plotted. */
  total: number;
  /**
   * Quotes the API recorded that day. Larger than `total` only when the day
   * overflows one page, in which case the caption says so rather than
   * presenting a truncated exhibit as the whole day.
   */
  recorded: number;
  /** The collection day these quotes were recorded on, e.g. 2026-08-04. */
  day: string;
}

function priceOf(offer: OfferSummary): number | null {
  const price = offer.normalized_price_usd_per_hour ?? offer.price_usd_per_hour;
  return typeof price === "number" && Number.isFinite(price) && price > 0
    ? price
    : null;
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * One lane per provider on a shared log axis, lanes ordered by their own
 * median so the exhibit has structure without colour doing the encoding.
 * Only the newest collection day is shown: the headline says "one day", so
 * the dots have to be one day.
 */
export function buildQuoteExhibit(
  offers: OfferSummary[],
  recordedTotal: number | null = null
): QuoteExhibit | null {
  const priced = offers
    .map((o) => ({ offer: o, price: priceOf(o) }))
    .filter((r): r is { offer: OfferSummary; price: number } => r.price !== null);

  if (priced.length === 0) return null;

  const days = priced.map((r) => r.offer.collected_at.slice(0, 10));
  const day = days.reduce((a, b) => (a > b ? a : b));
  const sameDay = priced.filter(
    (r) => r.offer.collected_at.slice(0, 10) === day
  );
  if (sameDay.length < MIN_QUOTES_FOR_EXHIBIT) return null;

  const bounds = axisBounds(sameDay.map((r) => r.price));
  if (bounds === null) return null;
  const { lo, hi } = bounds;

  const byProvider = new Map<string, QuoteDot[]>();
  sameDay.forEach(({ offer, price }) => {
    const dot: QuoteDot = {
      id: offer.id,
      price,
      provider: offer.provider,
      commitment: offer.commitment_type,
      region: offer.region_country,
      collectedAt: offer.collected_at,
      x: logPosition(price, lo, hi),
      y: hashUnit(offer.id),
    };
    const lane = byProvider.get(offer.provider);
    if (lane === undefined) byProvider.set(offer.provider, [dot]);
    else lane.push(dot);
  });

  const lanes: QuoteLane[] = [...byProvider.entries()]
    .map(([provider, dots]) => {
      const prices = dots.map((d) => d.price).sort((a, b) => a - b);
      return {
        provider,
        dots: dots.sort((a, b) => a.price - b.price),
        median: median(prices),
        low: prices[0],
        high: prices[prices.length - 1],
      };
    })
    .sort((a, b) => a.median - b.median);

  const total = sameDay.length;
  return {
    lanes,
    lo,
    hi,
    ticks: axisTicks(lo, hi),
    total,
    recorded: recordedTotal !== null && recordedTotal > total ? recordedTotal : total,
    day,
  };
}

/** Feet of footage at a given scroll progress, zero-padded like a leader. */
export function footageLabel(progress: number): string {
  const feet = Math.round(clamp01(progress) * REEL_LENGTH_FEET);
  return String(feet).padStart(4, "0");
}

/** "on_demand" reads as "on demand" in prose and slips. */
export function commitmentLabel(commitment: string): string {
  return commitment.replace(/_/g, " ");
}

/** A region we never learned stays visibly unknown, never imputed. */
export function regionLabel(region: string | null): string {
  return region === null || region.trim() === "" ? "UNKNOWN" : region;
}

export function usd(price: number): string {
  return `$${price.toFixed(2)}`;
}
