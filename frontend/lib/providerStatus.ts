import type { ProviderSummary } from "@/lib/types";

/**
 * Staleness rule for the providers table.
 *
 * Collection runs twice daily, so a provider that has produced nothing for a
 * full week is not a collection hiccup — it has stopped supplying quotes.
 * The cron sample is what defines "active"; no provider is ever named in
 * code, so a provider that resumes collecting becomes active again on its
 * next run without a deploy.
 *
 * Retired providers keep their rows: their historical offers are real corpus
 * history. What the tag removes is the false impression that they are still
 * being collected.
 */
export const PROVIDER_STALE_AFTER_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isProviderRetired(
  provider: ProviderSummary,
  now: number = Date.now()
): boolean {
  // A provider that has never reported cannot demonstrate activity.
  if (!provider.latest_collection) return true;

  const latest = new Date(provider.latest_collection).getTime();
  if (Number.isNaN(latest)) return true;

  return now - latest > PROVIDER_STALE_AFTER_DAYS * MS_PER_DAY;
}

export type PartitionedProviders = {
  active: ProviderSummary[];
  retired: ProviderSummary[];
  /** Active rows first, retired below, each block by offer count desc. */
  ordered: ProviderSummary[];
};

export function partitionProviders(
  items: ProviderSummary[],
  now: number = Date.now()
): PartitionedProviders {
  const byOfferCount = (a: ProviderSummary, b: ProviderSummary) =>
    b.offer_count - a.offer_count;

  const active = items.filter((item) => !isProviderRetired(item, now)).sort(byOfferCount);
  const retired = items.filter((item) => isProviderRetired(item, now)).sort(byOfferCount);

  return { active, retired, ordered: [...active, ...retired] };
}

const NUMBER_WORDS = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
];

/** "Five" for 5; falls back to digits past ten. */
export function numberWord(value: number): string {
  return NUMBER_WORDS[value] ?? String(value);
}
