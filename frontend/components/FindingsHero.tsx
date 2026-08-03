"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { useSku } from "@/lib/useSku";
import {
  getBasisTimeseries,
  getFungibilityMatrix,
  getProviders,
} from "@/lib/api";
import { ResidualTimeSeriesChart } from "@/components/ResidualTimeSeriesChart";
import { ShowMeHow } from "@/components/disclosure/TwoLayer";
import { getMlExplainability } from "@/lib/mlExplainability";

// Azure and GCP publish fixed list catalogs; excluding them leaves the
// market-priced segments (marketplaces + spot) the hero speaks about.
const CATALOG_PROVIDERS = ["azure", "gcp"];
const CATALOG_EXCLUSION_KEY = `exclude:${CATALOG_PROVIDERS.join(",")}`;

// Anchored structural claims — dated findings, not live aggregates. Per
// design doc A6 they interpolate from the artifact's trained_at, so every
// retrain flows through with zero copy edits.
/**
 * Qualitative share language that can never contradict the number beside
 * it (Quarantine Rule): the qualifier derives from the live ICC.
 */
export function iccQualifier(icc: number): string {
  if (icc >= 0.5) return "over half";
  if (icc >= 1 / 3) return "a third or more";
  return "a persistent share";
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function FindingsHeroInner() {
  const { sku } = useSku();

  // Shares its key with the chart on the right, so the market-priced
  // series is fetched once and read by both.
  const tsMarket = useQuery({
    queryKey: ["basis-timeseries", sku, null, null, CATALOG_EXCLUSION_KEY],
    queryFn: () =>
      getBasisTimeseries(sku, { excludeProviders: CATALOG_PROVIDERS }),
    // The backend recomputes on demand; if it 404s while the surface
    // is mid-deploy, fall back to the static window label rather than
    // retrying aggressively.
    retry: 1,
  });

  const matrix = useQuery({
    queryKey: ["fungibility-matrix"],
    queryFn: () => getFungibilityMatrix(),
  });
  const providers = useQuery({
    queryKey: ["providers"],
    queryFn: () => getProviders(),
  });

  const artifact = useQuery({
    queryKey: ["ml-explainability"],
    queryFn: () => getMlExplainability(),
    staleTime: 15 * 60 * 1000,
  });

  const marketPoints = tsMarket.data?.points ?? [];

  const gapPp = artifact.data ? artifact.data.metrics.gap * 100 : null;
  const icc = artifact.data ? artifact.data.host_analysis.icc : null;
  const trainedDate = artifact.data
    ? shortDate(artifact.data.metadata.trained_at)
    : null;
  const gapDisplay =
    gapPp === null ? "—" : `−${Math.abs(gapPp).toFixed(1)}pp`;
  const iccDisplay = icc === null ? "—" : icc.toFixed(2);

  const totalOffers =
    providers.data?.items.reduce((s, p) => s + p.offer_count, 0) ?? null;
  const skuCount = matrix.data?.items.length ?? null;
  const providerCount = providers.data?.items.length ?? null;

  const windowLabel =
    marketPoints.length > 0
      ? `last ${marketPoints.length} days`
      : "last 30 days";

  return (
    <section
      className="block"
      style={{
        padding: "40px 0 36px",
        borderBottom: "1px solid var(--line-lo)",
      }}
    >
      <div>
        <div
          className="eyebrow basis-fade"
          style={
            {
              marginBottom: 18,
              "--basis-delay": "100ms",
            } as React.CSSProperties
          }
        >
          Finding · {sku} · {windowLabel} · Market-priced segments
        </div>

        <h1
          className="serif basis-fade fh-statement"
          style={{ "--basis-delay": "150ms" } as React.CSSProperties}
        >
          A bigger model doesn&rsquo;t explain it away.
        </h1>

        <dl className="fh-tape basis-fade" style={{ "--basis-delay": "350ms" } as React.CSSProperties}>
          <TapeCell
            value={gapDisplay}
            aria={
              gapPp === null
                ? "gap unavailable"
                : `negative ${Math.abs(gapPp).toFixed(1)} percentage points`
            }
            label="out-of-sample gap"
          />
          <TapeCell
            value={iccDisplay}
            aria={icc === null ? "ICC unavailable" : icc.toFixed(2)}
            label="host-identity ICC"
          />
          <TapeCell
            value="~20–61%"
            aria="approximately 20 to 61 percent"
            label="unexplained · recent weeks"
          />
        </dl>

        <div
          className="fh-actions basis-fade"
          style={{ "--basis-delay": "600ms" } as React.CSSProperties}
        >
          <Link className="btn" href="/basis">
            See the decomposition →
          </Link>
          <Link className="btn ghost" href="/methodology">
            Methodology
          </Link>
        </div>

        <div
          className="basis-fade"
          style={
            {
              maxWidth: 620,
              marginTop: 18,
              "--basis-delay": "750ms",
            } as React.CSSProperties
          }
        >
          <ShowMeHow label="Show me how we know">
            <p>
              Even a 45-feature ML model can&rsquo;t close the unexplained
              gap out-of-sample
              {trainedDate ? ` (as of ${trainedDate})` : ""};{" "}
              {icc === null ? "a persistent share" : iccQualifier(icc)} of
              what remains is persistent host identity
              {icc === null ? "" : ` (ICC ${icc.toFixed(2)})`}.
            </p>
            <p>
              Unexplained share in market-priced segments has ranged ~20–61%
              across recent weeks — basis risk is segment- and
              time-conditional.
            </p>
            <p>
              The gap compares the 45-feature model&rsquo;s honest
              out-of-sample fit against the four simple factors&rsquo;
              in-sample share — one picture, not two separate confirmations.
              Both anchors are dated structural claims from the published
              artifact; inspect them on the{" "}
              <Link href="/explainability">explainability page</Link>.
            </p>
          </ShowMeHow>
        </div>
      </div>

      <div
        className="panel"
        style={{ padding: 22, marginTop: 36 }}
      >
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          Residual share · market-priced segments · {windowLabel}
        </div>
        <ResidualTimeSeriesChart
          gpuSku={sku}
          excludeProviders={CATALOG_PROVIDERS}
        />
        <p
          className="caption"
          style={{ marginTop: 12, marginBottom: 0, lineHeight: 1.55 }}
        >
          Jul 26 — Era D: Vast spot pricing becomes visible (collector fix).
          Jul 28 — Azure/GCP list catalogs join the corpus (excluded from
          this series).
        </p>
        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px solid var(--line-lo)",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 14,
          }}
        >
          <Stat
            label="Offers"
            val={totalOffers === null ? null : totalOffers.toLocaleString()}
            loading={providers.isLoading}
            error={providers.isError}
          />
          <Stat
            label="Canonical SKUs"
            val={skuCount === null ? null : skuCount.toLocaleString()}
            loading={matrix.isLoading}
            error={matrix.isError}
          />
          <Stat
            label="Providers"
            val={providerCount === null ? null : providerCount.toLocaleString()}
            loading={providers.isLoading}
            error={providers.isError}
          />
        </div>
      </div>
    </section>
  );
}

export function FindingsHero() {
  return (
    <Suspense
      fallback={
        <section
          className="block"
          style={{
            gap: 64,
            padding: "40px 0 36px",
            borderBottom: "1px solid var(--line-lo)",
          }}
        >
          <p className="caption">Loading…</p>
        </section>
      }
    >
      <FindingsHeroInner />
    </Suspense>
  );
}

function TapeCell({
  value,
  aria,
  label,
}: {
  value: string;
  aria: string;
  label: string;
}) {
  return (
    <div className="fh-tape__cell">
      <dt
        className="display fh-tape__num"
        aria-live="off"
        aria-label={`${aria} ${label}`}
      >
        {value}
      </dt>
      <dd className="fh-tape__label">{label}</dd>
    </div>
  );
}

function Stat({
  label,
  val,
  loading,
  error,
}: {
  label: string;
  val: string | null;
  loading: boolean;
  error: boolean;
}) {
  const display = loading ? "…" : error || val === null ? "—" : val;
  const dim = loading || error || val === null;
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>
        {label}
      </div>
      <div
        className="mono"
        style={{
          fontSize: 16,
          color: dim ? "var(--ink-dim)" : "var(--ink)",
          letterSpacing: "-0.01em",
        }}
      >
        {display}
      </div>
    </div>
  );
}
