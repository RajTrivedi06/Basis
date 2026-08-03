/**
 * Ledger arithmetic for the decomposition waterfall (exploration variant 1e).
 *
 * The ledger starts at 100% — the price we can't explain, before accounting —
 * and subtracts one factor per row until what's left is the residual. Every
 * figure here is computed from the live decomposition; nothing is hardcoded,
 * and the factor rows are discovered from the response rather than assumed,
 * so a fifth factor would render a fifth row on its own.
 */

import { factorColor, type Factor } from "@/lib/factorColor";

const VARIANCE_PREFIX = "variance_from_";

/**
 * Sequential-ANOVA order, mirroring FACTOR_ORDER in
 * backend/basis/analytics/basis.py. Response key order cannot stand in for it:
 * the schema declares bundle before provider while the model attributes
 * provider first. Factors not named here keep their response order and render
 * after these — an unfamiliar factor is shown, never dropped.
 */
const ANOVA_ORDER: readonly string[] = [
  "region",
  "commitment",
  "provider",
  "bundle",
];

/** Ruled row copy (variant 1e). A factor without ruled copy shows only its tag. */
const ROW_PHRASE: Record<string, string> = {
  region: "where it is",
  commitment: "how it's rented",
  provider: "who sells it",
  bundle: "what's bundled",
};

export interface LedgerRow {
  /** Factor key as the API names it, e.g. `region`. */
  key: string;
  /** Plain-language phrase, or null where we have no ruled copy for the factor. */
  phrase: string | null;
  /** Mono tag, e.g. `REGION`. */
  tag: string;
  /** CSS token for the factor's swatch and depletion slice. */
  color: string;
  /** Share of total variance this factor accounts for, 0–1. */
  share: number;
  /** Share still unaccounted for before this row is subtracted, 0–1. */
  before: number;
  /** Share still unaccounted for after this row is subtracted, 0–1. */
  after: number;
}

export interface Ledger {
  rows: LedgerRow[];
  /** The unfileable remainder, 0–1. */
  residualShare: number;
}

function isKnownFactor(key: string): key is Exclude<Factor, "residual"> {
  return ANOVA_ORDER.includes(key);
}

function orderIndex(key: string): number {
  const at = ANOVA_ORDER.indexOf(key);
  return at === -1 ? Number.MAX_SAFE_INTEGER : at;
}

function tagFor(key: string): string {
  return key.replace(/_/g, " ").toUpperCase();
}

function share(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, value / total);
}

/**
 * Reads the ledger off a decomposition response. Accepts the wider record type
 * so a factor added to the API arrives as a row without a frontend change.
 */
export function buildLedger(
  data: Record<string, unknown> & { total_variance?: unknown }
): Ledger {
  const total = typeof data.total_variance === "number" ? data.total_variance : 0;

  const keys = Object.keys(data)
    .filter(
      (key) =>
        key.startsWith(VARIANCE_PREFIX) && typeof data[key] === "number"
    )
    .map((key) => key.slice(VARIANCE_PREFIX.length));

  // Stable: named factors in model order, then anything new in response order.
  const ordered = keys
    .map((key, at) => ({ key, at }))
    .sort((a, b) => orderIndex(a.key) - orderIndex(b.key) || a.at - b.at)
    .map((entry) => entry.key);

  let remaining = 1;
  const rows: LedgerRow[] = ordered.map((key) => {
    const value = share(data[`${VARIANCE_PREFIX}${key}`] as number, total);
    const before = remaining;
    remaining = Math.max(0, remaining - value);
    return {
      key,
      phrase: ROW_PHRASE[key] ?? null,
      tag: tagFor(key),
      color: isKnownFactor(key) ? factorColor(key) : "var(--unknown)",
      share: value,
      before,
      after: remaining,
    };
  });

  const residualShare =
    typeof data.residual_variance === "number"
      ? share(data.residual_variance, total)
      : remaining;

  return { rows, residualShare };
}

/**
 * Per-row scrub position. A bare number advances the whole ledger — one row at
 * a time, the void block landing last; an array drives rows individually.
 * `undefined` means the ledger is simply finished.
 */
export function rowProgress(
  progress: number | number[] | undefined,
  index: number,
  steps: number
): number {
  if (progress === undefined) return 1;
  if (Array.isArray(progress)) return clamp01(progress[index] ?? 0);
  if (steps <= 0) return 1;
  return clamp01(progress * steps - index);
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function formatShare(fraction: number): string {
  return (fraction * 100).toFixed(1);
}
