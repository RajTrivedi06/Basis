"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { WatchList, formatObserved } from "@/components/providers/WatchList";
import { getProviders } from "@/lib/api";
import { sheetLabel } from "@/lib/nav";
import {
  PROVIDER_STALE_AFTER_DAYS,
  numberWord,
  partitionProviders,
} from "@/lib/providerStatus";

function PageHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="prov-head">
      <div className="prov-head__eyebrow">Source posture</div>
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
      <div className="page-wide fade-up prov-page">
        <PageHead>
          <p className="prov-head__lede">Loading providers…</p>
        </PageHead>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page-wide fade-up prov-page">
        <PageHead>
          <p className="prov-head__lede text-[var(--verdict-bad)]">
            Failed to load: {(error as Error)?.message ?? "unknown error"}
          </p>
        </PageHead>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="page-wide fade-up prov-page">
        <PageHead>
          <p className="prov-head__lede">No provider data available.</p>
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
  const latestIso = ordered.reduce<string | null>((best, p) => {
    if (!p.latest_collection) return best;
    if (!best) return p.latest_collection;
    return p.latest_collection > best ? p.latest_collection : best;
  }, null);
  const compiled = formatObserved(latestIso);

  return (
    <div className="page-wide fade-up prov-page">
      <header className="prov-head">
        <div className="prov-head__row">
          <div>
            <div className="prov-head__eyebrow">Source posture</div>
            <h1 className="prov-head__title">
              {activeWord} {noun},{" "}
              <em>
                {activeWord.toLowerCase()} {posture}.
              </em>
            </h1>
            <p className="prov-head__lede">
              Columns below are exactly what the public{" "}
              <span className="mono text-[var(--ink)]">GET /api/providers</span>{" "}
              returns: nothing inferred, embellished, or backfilled.
            </p>
          </div>
          <div className="prov-head__meta">
            <div className="prov-head__meta-label">Collected twice daily</div>
            <div className="prov-head__meta-value">
              {ordered.length} rows · {totalOffers.toLocaleString("en-US")}{" "}
              offers <span className="prov-head__live">LIVE</span>
            </div>
          </div>
        </div>
      </header>

      <WatchList items={ordered} />

      <div className="prov-notes">
        <div>
          <h2 className="prov-notes__title">Marketplace caution</h2>
          <p>
            Marketplace subjects aggregate many independent listings, not a
            single price policy. Quoted public prices only, never executed
            trades.
          </p>
        </div>
        <div>
          <h2 className="prov-notes__title">Retired rows</h2>
          <p>
            No collection in the last {PROVIDER_STALE_AFTER_DAYS} days earns the{" "}
            <span className="mono">RETIRED</span> tag and a place below the
            active. Historical offers stay in the corpus; surveillance stopped,
            the file did not close.
          </p>
        </div>
        <div>
          <h2 className="prov-notes__title">Headline count</h2>
          <p>
            The title counts subjects still collecting, by the same staleness
            rule. No provider is named in code; one resumes and it rejoins the
            count on its own.
          </p>
        </div>
      </div>

      <footer className="prov-sheet-foot">
        <span className="prov-sheet-foot__stamp">
          {sheetLabel("/providers")} · COMPILED <em className="serif">Basis</em>
          {compiled !== "-" ? ` · ${compiled}` : null}
        </span>
        <Link href="/basis" className="prov-sheet-foot__next">
          Next: which factors absorb the difference →
        </Link>
      </footer>
    </div>
  );
}
