"use client";

import { useQuery } from "@tanstack/react-query";
import { getProviders } from "@/lib/api";
import {
  PROVIDER_STALE_AFTER_DAYS,
  isProviderRetired,
  numberWord,
  partitionProviders,
} from "@/lib/providerStatus";
import type { ProviderSummary } from "@/lib/types";

function deviationClass(pct: number | null): string {
  if (pct === null) return "text-[var(--ink-dim)]";
  if (pct > 0) return "text-[var(--verdict-warn)]";
  return "text-[var(--verdict-ok)]";
}

function formatDeviation(pct: number | null): string {
  if (pct === null) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export default function ProvidersPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["providers"],
    queryFn: getProviders,
  });

  if (isLoading) {
    return (
      <div className="page-wide fade-up">
        <div className="eyebrow mb-2.5">07 · Providers</div>
        <p className="caption">Loading providers…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page-wide fade-up">
        <div className="eyebrow mb-2.5">07 · Providers</div>
        <p className="caption text-[var(--verdict-bad)]">
          Failed to load: {(error as Error)?.message ?? "unknown error"}
        </p>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="page-wide fade-up">
        <div className="eyebrow mb-2.5">07 · Providers</div>
        <p className="caption">No provider data available.</p>
      </div>
    );
  }

  const { active, ordered } = partitionProviders(data.items);
  const activeCount = active.length;
  const activeWord = numberWord(activeCount);
  const noun = activeCount === 1 ? "provider" : "providers";
  const posture = activeCount === 1 ? "posture" : "postures";

  return (
    <div className="page-wide fade-up">
      <section className="pb-6 pt-9">
        <div className="eyebrow mb-2.5">07 · Providers</div>
        <h1 className="display m-0 max-w-[720px] text-[clamp(2rem,5vw,2.5rem)] font-normal leading-[1.1] tracking-[-0.02em] text-[var(--ink-hi)]">
          {activeWord} {noun},{" "}
          <em className="font-serif not-italic text-[var(--ink-mid)]">
            {activeWord.toLowerCase()} {posture}.
          </em>
        </h1>
      </section>

      <p className="caption mb-4 max-w-[720px]">
        Columns below match the public{" "}
        <span className="mono text-[var(--ink-mid)]">GET /api/providers</span>{" "}
        schema only; we do not show fields the API does not return.
      </p>

      <div className="panel overflow-hidden">
        <table className="tbl">
          <thead>
            <tr>
              <th>Provider</th>
              <th className="text-right">Offers</th>
              <th className="text-right">Distinct SKUs</th>
              <th className="text-right">Median Δ vs market</th>
              <th className="text-right">Latest collection</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((p: ProviderSummary) => (
              <tr key={p.provider}>
                <td className="text-[var(--ink-hi)]">
                  <span className="inline-flex items-center gap-2">
                    {p.provider}
                    {isProviderRetired(p) ? (
                      <span className="tag-quiet mono">Retired</span>
                    ) : null}
                  </span>
                </td>
                <td className="num text-right">
                  {p.offer_count.toLocaleString()}
                </td>
                <td className="num text-right">{p.distinct_skus}</td>
                <td
                  className={`num text-right ${deviationClass(p.median_deviation_pct)}`}
                >
                  {formatDeviation(p.median_deviation_pct)}
                </td>
                <td className="caption mono text-right">
                  {p.latest_collection
                    ? new Date(p.latest_collection).toLocaleString()
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="caption mt-8 max-w-3xl space-y-2 leading-relaxed">
        <p>
          <span className="text-[var(--ink)]">Median Δ vs market</span> is the
          mean across SKUs of provider median minus market median on the
          latest collection date (see API docs). Positive values skew above
          the cross-provider market for that SKU mix; negative values skew
          below.
        </p>
        <p>
          Marketplace providers aggregate many independent listings; the
          deviation reflects the marketplace aggregate, not a single price
          policy. Figures are quoted public prices only.
        </p>
        <p>
          A provider with no collection in the last {PROVIDER_STALE_AFTER_DAYS}{" "}
          days is tagged <span className="text-[var(--ink)]">Retired</span> and
          sorted below the active rows. Its historical offers stay in the
          corpus and in the totals above — the tag marks that it is no longer
          being collected, not that its data was removed.
        </p>
      </div>
    </div>
  );
}
