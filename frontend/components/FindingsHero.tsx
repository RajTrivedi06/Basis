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
      className="grid items-start grid-cols-1 md:grid-cols-[1.3fr_1fr]"
      style={{
        gap: 64,
        padding: "40px 0 36px",
        borderBottom: "1px solid var(--line-lo)",
      }}
    >
      <div>
        <div
          className="eyebrow basis-fade"
          style={
            {
              marginBottom: 22,
              "--basis-delay": "100ms",
            } as React.CSSProperties
          }
        >
          Finding · {sku} · {windowLabel} · Market-priced segments
        </div>

        <h1
          className="serif basis-fade"
          style={
            {
              margin: "0 0 26px",
              fontSize: "clamp(26px, 3vw, 40px)",
              fontWeight: 500,
              lineHeight: 1.12,
              letterSpacing: "-0.02em",
              color: "var(--ink-hi)",
              maxWidth: 560,
              "--basis-delay": "150ms",
            } as React.CSSProperties
          }
        >
          A bigger model doesn&rsquo;t explain it away.
        </h1>

        {gapPp !== null || icc !== null ? (
          <dl
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "clamp(32px, 5vw, 48px)",
              margin: 0,
            }}
          >
            <HeroNumber
              valueLabel={gapDisplay}
              ariaValue={
                gapPp === null
                  ? "gap unavailable"
                  : `negative ${Math.abs(gapPp).toFixed(1)} percentage points`
              }
              primary="out-of-sample gap"
              secondary="45 features still explain less than 4 simple factors"
              numberDelay="250ms"
              labelDelay="700ms"
            />
            <HeroNumber
              valueLabel={iccDisplay}
              ariaValue={icc === null ? "ICC unavailable" : icc.toFixed(2)}
              primary="host-identity ICC"
              secondary={`${icc === null ? "how much" : iccQualifier(icc)} of what's left sticks to specific machines`}
              numberDelay="250ms"
              labelDelay="700ms"
            />
          </dl>
        ) : (
          <p
            className="caption basis-fade"
            style={{ maxWidth: 480, margin: "0 0 4px" } as React.CSSProperties}
          >
            The anchored figures load from the published artifact — see the{" "}
            <Link href="/explainability">explainability page</Link>.
          </p>
        )}

        <p
          className="basis-fade"
          style={
            {
              maxWidth: 560,
              marginTop: 22,
              fontSize: 13,
              lineHeight: 1.65,
              color: "var(--ink-mid)",
              "--basis-delay": "900ms",
            } as React.CSSProperties
          }
        >
          Unexplained share in market-priced segments has ranged ~20–61%
          across recent weeks — basis risk is segment- and
          time-conditional.
        </p>

        <div
          className="basis-fade"
          style={
            {
              maxWidth: 560,
              marginTop: 14,
              "--basis-delay": "1050ms",
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
              The gap compares the 45-feature model&rsquo;s honest
              out-of-sample fit against the four simple factors&rsquo;
              in-sample share — one picture, not two separate confirmations.
              Both anchors are dated structural claims from the published
              artifact; inspect them on the{" "}
              <Link href="/explainability">explainability page</Link>.
            </p>
          </ShowMeHow>
        </div>

        <div
          className="basis-fade"
          style={
            {
              display: "flex",
              gap: 10,
              marginTop: 28,
              "--basis-delay": "1550ms",
            } as React.CSSProperties
          }
        >
          <Link className="btn" href="/basis">
            See the decomposition →
          </Link>
          <Link className="btn ghost" href="/methodology">
            Methodology
          </Link>
        </div>
      </div>

      <div
        className="panel"
        style={{ padding: 22, marginTop: "clamp(40px, 6vh, 96px)" }}
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
          className="grid items-start grid-cols-1 md:grid-cols-[1.3fr_1fr]"
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

function HeroNumber({
  valueLabel,
  ariaValue,
  primary,
  secondary,
  numberDelay,
  labelDelay,
}: {
  valueLabel: string;
  ariaValue: string;
  primary: string;
  secondary: string;
  numberDelay: string;
  labelDelay: string;
}) {
  // Numbers are wrapped in a <dl><dt><dd> pair so screen readers read
  // each pair as a label/value unit. aria-live="off" keeps the count-up
  // tween from spamming announcements every frame; the aria-label is
  // derived from the final value, not the in-flight display value, so
  // screen readers always read the resolved number.
  return (
    <div
      className="basis-fade"
      style={
        {
          flex: "0 0 auto",
          "--basis-delay": numberDelay,
        } as React.CSSProperties
      }
    >
      <dt
        className="display"
        aria-live="off"
        aria-label={`${ariaValue} ${primary} ${secondary}`}
        style={{
          fontStyle: "italic",
          fontSize: "clamp(56px, 7.4vw, 112px)",
          lineHeight: 0.96,
          margin: 0,
          color: "var(--residual)",
          letterSpacing: "-0.03em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {valueLabel}
      </dt>
      <dd
        className="basis-fade"
        style={
          {
            margin: "12px 0 0",
            "--basis-delay": labelDelay,
          } as React.CSSProperties
        }
      >
        <div
          style={{
            fontSize: 13,
            color: "var(--ink)",
            letterSpacing: "0.005em",
          }}
        >
          {primary}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--ink-dim)",
            marginTop: 2,
            letterSpacing: "0.005em",
          }}
        >
          {secondary}
        </div>
      </dd>
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
