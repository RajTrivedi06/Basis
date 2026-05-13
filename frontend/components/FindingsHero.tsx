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

function FindingsHeroInner() {
  const { sku } = useSku();

  // Single 30-day timeseries query feeds both the hero range and the chart
  // below. The chart uses the same React Query key so the network call is
  // deduped — one fetch, two consumers.
  const timeseries = useQuery({
    queryKey: ["basis-timeseries", sku, null, null],
    queryFn: () => getBasisTimeseries(sku),
  });

  const matrix = useQuery({
    queryKey: ["fungibility-matrix"],
    queryFn: () => getFungibilityMatrix(),
  });
  const providers = useQuery({
    queryKey: ["providers"],
    queryFn: () => getProviders(),
  });

  const points = timeseries.data?.points ?? [];
  const tsLoading = timeseries.isLoading;
  const tsError = timeseries.isError;
  const tsEmpty = !tsLoading && !tsError && points.length === 0;

  const pcts = points.map((p) => p.pct_residual);
  const pctMin = pcts.length ? Math.min(...pcts) : null;
  const pctMax = pcts.length ? Math.max(...pcts) : null;

  const totalObs =
    matrix.data?.items.reduce((s, r) => s + r.observation_count, 0) ?? null;
  const skuCount = matrix.data?.items.length ?? null;
  const providerCount = providers.data?.items.length ?? null;

  const windowLabel =
    points.length > 0 ? `${points.length}-day window` : "30-day window";

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
        <div className="eyebrow" style={{ marginBottom: 18 }}>
          Finding · {sku} · {windowLabel}
        </div>
        <h1
          className="display"
          aria-live="polite"
          aria-atomic="true"
          style={{
            fontSize: "clamp(56px, 7.4vw, 112px)",
            lineHeight: 0.96,
            margin: 0,
            color: "var(--ink)",
            letterSpacing: "-0.03em",
            textWrap: "balance",
          }}
        >
          <HeroRange
            loading={tsLoading}
            error={tsError}
            empty={tsEmpty}
            min={pctMin}
            max={pctMax}
          />
          <br />
          <span style={{ fontStyle: "italic", fontWeight: 300, color: "var(--ink-mid)" }}>
            of log-price variance is unexplained.
          </span>
        </h1>
        <p
          style={{
            maxWidth: 560,
            marginTop: 32,
            fontSize: 16,
            lineHeight: 1.55,
            color: "var(--ink-mid)",
          }}
        >
          After controlling for the four observable factors —{" "}
          <span style={{ color: "var(--ink)" }}>
            region, commitment type, provider identity, bundled resources
          </span>{" "}
          — a residual this large remains. That residual is the basis risk any
          compute benchmark has to live with.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
          <Link className="btn" href="/basis">
            See the decomposition →
          </Link>
          <Link className="btn ghost" href="/methodology">
            Methodology
          </Link>
        </div>
      </div>

      <div className="panel" style={{ padding: 22, marginTop: "clamp(40px, 6vh, 96px)" }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          Residual share · last 30 days
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
            label="Observations"
            val={totalObs === null ? null : totalObs.toLocaleString()}
            loading={matrix.isLoading}
            error={matrix.isError}
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

function HeroRange({
  loading,
  error,
  empty,
  min,
  max,
}: {
  loading: boolean;
  error: boolean;
  empty: boolean;
  min: number | null;
  max: number | null;
}) {
  if (loading) {
    return <span style={{ color: "var(--residual)" }}>…</span>;
  }
  if (error || empty || min === null || max === null) {
    return <span style={{ color: "var(--ink-dim)" }}>—</span>;
  }
  if (Math.round(min) === Math.round(max)) {
    return <span style={{ color: "var(--residual)" }}>{min.toFixed(0)}%</span>;
  }
  return (
    <span style={{ color: "var(--residual)" }}>
      {min.toFixed(0)}–{max.toFixed(0)}%
    </span>
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
