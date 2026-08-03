"use client";

import { useQuery } from "@tanstack/react-query";
import { ShowMeHow } from "@/components/disclosure/TwoLayer";
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
  // Arrow doubles the sign so the direction survives a greyscale print and
  // does not rely on colour alone.
  const arrow = pct > 0 ? "↑" : "↓";
  return `${arrow} ${Math.abs(pct).toFixed(1)}%`;
}

function ProviderCard({ p }: { p: ProviderSummary }) {
  return (
    <div className="prov-card panel">
      <div className="prov-card__head">
        <span className="prov-card__name">{p.provider}</span>
        {isProviderRetired(p) ? (
          <span className="tag-quiet mono">Retired</span>
        ) : null}
        <span
          className={`mono prov-card__delta ${deviationClass(p.median_deviation_pct)}`}
        >
          {formatDeviation(p.median_deviation_pct)}
        </span>
      </div>
      <div className="mono prov-card__meta">
        <span>{p.offer_count.toLocaleString()} offers</span>
        <span>{p.distinct_skus} SKUs</span>
      </div>
      <div className="mono prov-card__ts">
        latest{" "}
        {p.latest_collection
          ? new Date(p.latest_collection).toLocaleString()
          : "—"}
      </div>
    </div>
  );
}

function PageHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="int-head">
      <div className="int-head__eyebrow">
        <span className="num">04</span>
        <span>Source posture</span>
      </div>
      {children}
    </div>
  );
}

export default function ProvidersPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["providers"],
    queryFn: getProviders,
  });

  if (isLoading) {
    return (
      <div className="page-wide fade-up">
        <PageHead>
          <p className="int-head__lede">Loading providers…</p>
        </PageHead>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page-wide fade-up">
        <PageHead>
          <p className="int-head__lede text-[var(--verdict-bad)]">
            Failed to load: {(error as Error)?.message ?? "unknown error"}
          </p>
        </PageHead>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="page-wide fade-up">
        <PageHead>
          <p className="int-head__lede">No provider data available.</p>
        </PageHead>
      </div>
    );
  }

  // C18: the count is structural. It reads the active subset, so a retirement
  // rewrites the headline without a copy edit.
  const { active, ordered } = partitionProviders(data.items);
  const activeCount = active.length;
  const activeWord = numberWord(activeCount);
  const noun = activeCount === 1 ? "provider" : "providers";
  const posture = activeCount === 1 ? "posture" : "postures";
  const totalOffers = ordered.reduce((sum, p) => sum + p.offer_count, 0);

  return (
    <div className="page-wide fade-up">
      <PageHead>
        <h1 className="int-head__title">
          {activeWord} {noun}, <em>{activeWord.toLowerCase()} {posture}.</em>
        </h1>
        <p className="int-head__lede">
          Columns below are exactly what the public{" "}
          <span className="mono text-[var(--ink)]">GET /api/providers</span>{" "}
          returns — nothing inferred, embellished, or backfilled.
        </p>
      </PageHead>

      <div className="int-controls">
        <div className="int-controls__group">
          <span className="int-controls__label">Collected twice daily</span>
        </div>
        <span className="int-controls__meta">
          {ordered.length} rows · {totalOffers.toLocaleString()} offers
        </span>
      </div>

      <div className="prov-cards">
        {ordered.map((p: ProviderSummary) => (
          <ProviderCard key={p.provider} p={p} />
        ))}
      </div>

      <div className="panel prov-table overflow-hidden">
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

      <div className="mt-7 max-w-[68ch]">
        <ShowMeHow label="Show me how Δ vs market is computed">
          <p>
            <span className="text-[var(--ink)]">Median Δ vs market</span> is the
            mean across SKUs of provider median minus market median on the
            latest collection date (see API docs). Positive values skew above
            the cross-provider market for that SKU mix; negative values skew
            below.
          </p>
          <p>
            It is a posture, not a verdict: a provider can sit above the market
            because it lists different regions or bundles, not because it
            charges more for the same thing. That is exactly the confusion the
            decomposition exists to settle.
          </p>
        </ShowMeHow>
      </div>

      <div className="int-notes int-notes--three">
        <p>
          <strong>Marketplace caution.</strong> Marketplace providers aggregate
          many independent listings; the deviation reflects the marketplace
          aggregate, not a single price policy. Figures are quoted public
          prices only.
        </p>
        <p>
          <strong>Retired rows.</strong> A provider with no collection in the
          last {PROVIDER_STALE_AFTER_DAYS} days is tagged Retired and sorted
          below the active rows. Its historical offers stay in the corpus and in
          the totals above — the tag marks that it is no longer being collected,
          not that its data was removed.
        </p>
        <p>
          <strong>Headline count.</strong> The count in the headline is the
          number of providers still collecting, taken from the same staleness
          rule the table uses. No provider is named in code, so a source that
          resumes rejoins the count on its next run.
        </p>
      </div>
    </div>
  );
}
