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
import { useCountUp } from "@/lib/useCountUp";

const EXCLUDED_PROVIDERS = ["vast"];

function FindingsHeroInner() {
  const { sku } = useSku();

  // Two timeseries queries with distinct React Query keys so they
  // dedupe independently. The "full" query also dedupes with the chart
  // on the right (matching key shape — the trailing `null` reserves
  // space for the no-Vast variant). The "no-Vast" query asks the
  // backend to recompute the decomposition with Vast filtered out.
  const tsFull = useQuery({
    queryKey: ["basis-timeseries", sku, null, null, null],
    queryFn: () => getBasisTimeseries(sku),
  });
  const tsNoVast = useQuery({
    queryKey: ["basis-timeseries", sku, null, null, "exclude:vast"],
    queryFn: () =>
      getBasisTimeseries(sku, { excludeProviders: EXCLUDED_PROVIDERS }),
    // The backend recomputes on demand; if it 404s while the surface
    // is mid-deploy, surface the error gracefully via the "—" sentinel
    // rather than retrying aggressively.
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

  const fullPoints = tsFull.data?.points ?? [];
  const noVastPoints = tsNoVast.data?.points ?? [];

  const fullMedian = computeMedianPct(fullPoints, tsFull.isSuccess);
  const noVastMedian = computeMedianPct(noVastPoints, tsNoVast.isSuccess);

  // Count-up tweens. First number leads slightly, second trails by
  // ~200ms so the eye reads them sequentially rather than competing.
  const fullDisplay = useCountUp(fullMedian, 1100, 300);
  const noVastDisplay = useCountUp(noVastMedian, 1100, 500);

  const totalOffers =
    providers.data?.items.reduce((s, p) => s + p.offer_count, 0) ?? null;
  const skuCount = matrix.data?.items.length ?? null;
  const providerCount = providers.data?.items.length ?? null;

  const windowLabel =
    fullPoints.length > 0
      ? `last ${fullPoints.length} days`
      : "last 30 days";

  // Dynamic delta for the body paragraph. Hidden when either query is
  // not yet resolved so we never render a misleading "0 percentage
  // points" placeholder.
  const delta =
    fullMedian !== null && noVastMedian !== null
      ? Math.round(Math.abs(noVastMedian - fullMedian))
      : null;

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
          Finding · {sku} · {windowLabel} · Segment-conditional
        </div>

        <dl
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "clamp(32px, 5vw, 48px)",
            margin: 0,
          }}
        >
          <HeroNumber
            valueLabel={fullDisplay}
            target={fullMedian}
            primary="marketplace pricing"
            secondary="(Vast-dominated)"
            numberDelay="200ms"
            labelDelay="1000ms"
          />
          <HeroNumber
            valueLabel={noVastDisplay}
            target={noVastMedian}
            primary="curated providers"
            secondary="(Vast excluded)"
            numberDelay="200ms"
            labelDelay="1000ms"
          />
        </dl>

        <p
          className="serif basis-fade"
          style={
            {
              marginTop: 28,
              maxWidth: 620,
              fontStyle: "italic",
              fontSize: "clamp(16px, 1.6vw, 22px)",
              lineHeight: 1.35,
              color: "var(--ink)",
              letterSpacing: "-0.005em",
              "--basis-delay": "1250ms",
            } as React.CSSProperties
          }
        >
          of log-price variance is unexplained — and the answer depends on
          which segment of the market you measure.
        </p>

        <p
          className="basis-fade"
          style={
            {
              maxWidth: 560,
              marginTop: 18,
              fontSize: 13,
              lineHeight: 1.65,
              color: "var(--ink-mid)",
              "--basis-delay": "1400ms",
            } as React.CSSProperties
          }
        >
          {delta !== null ? (
            <>
              Vast.ai accounts for 80% of canonical offers; including it
              pulls the residual down by {delta} percentage points. Both
              are basis risk benchmark designs have to live with.
            </>
          ) : (
            <>
              Vast.ai accounts for 80% of canonical offers; including it
              pulls the residual down materially. Both are basis risk
              benchmark designs have to live with.
            </>
          )}
        </p>

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
          Residual share · {windowLabel}
        </div>
        <ResidualTimeSeriesChart gpuSku={sku} />
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
  target,
  primary,
  secondary,
  numberDelay,
  labelDelay,
}: {
  valueLabel: string;
  target: number | null;
  primary: string;
  secondary: string;
  numberDelay: string;
  labelDelay: string;
}) {
  // Numbers are wrapped in a <dl><dt><dd> pair so screen readers read
  // each pair as a label/value unit. aria-live="off" keeps the count-up
  // tween from spamming announcements every frame; the aria-label is
  // derived from the target (final) value, not the in-flight display
  // value, so screen readers always read the resolved number.
  const ariaValue =
    target === null
      ? "data unavailable"
      : `approximately ${Math.round(target)} percent`;
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

function computeMedianPct(
  points: { pct_residual: number }[],
  isReady: boolean
): number | null {
  if (!isReady || points.length === 0) return null;
  const vals = points.map((p) => p.pct_residual);
  return median(vals);
}

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
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
