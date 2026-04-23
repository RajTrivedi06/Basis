"use client";

import Link from "next/link";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { useSku } from "@/lib/useSku";
import {
  getBasisDecomposition,
  getDispersion,
  getFungibilityMatrix,
  getProviders,
} from "@/lib/api";
import type { BasisDecompositionResponse } from "@/lib/types";

function FindingsHeroInner() {
  const { sku } = useSku();

  // Dispersion tells us which dates the focus SKU has data for.
  const dispersion = useQuery({
    queryKey: ["dispersion", sku],
    queryFn: () => getDispersion(sku),
  });

  const dates = (dispersion.data?.points ?? [])
    .map((p) => p.date)
    .sort()
    .slice(-3);

  // TODO(backend): replace with windowed /api/basis/{sku}?since=&until=
  // when the backend agent work begins. Three round-trips are fine for a
  // 3-day window; they won't scale to Phase D's 60-day rolling window.
  const basis = useQueries({
    queries: dates.map((d) => ({
      queryKey: ["basis", sku, d],
      queryFn: () => getBasisDecomposition(sku, { date: d }),
      enabled: !!d,
    })),
  });

  const matrix = useQuery({
    queryKey: ["fungibility-matrix"],
    queryFn: () => getFungibilityMatrix(),
  });
  const providers = useQuery({
    queryKey: ["providers"],
    queryFn: () => getProviders(),
  });

  const decomps: BasisDecompositionResponse[] = basis
    .map((q) => q.data)
    .filter((d): d is BasisDecompositionResponse => !!d);

  const datesLoading = dispersion.isLoading;
  const basisLoading =
    datesLoading ||
    (dates.length > 0 &&
      (basis.some((q) => q.isLoading) || decomps.length < dates.length));
  const basisError = dispersion.isError || basis.some((q) => q.isError);
  const basisEmpty = !datesLoading && !basisError && dates.length === 0;

  const pcts = decomps.map((d) => d.pct_residual);
  const pctMin = pcts.length ? Math.min(...pcts) : null;
  const pctMax = pcts.length ? Math.max(...pcts) : null;

  const totalObs =
    matrix.data?.items.reduce((s, r) => s + r.observation_count, 0) ?? null;
  const skuCount = matrix.data?.items.length ?? null;
  const providerCount = providers.data?.items.length ?? null;

  const windowLabel =
    dates.length > 0 ? `${dates.length}-day window` : "3-day window";

  return (
    <section
      className="grid items-start"
      style={{
        gridTemplateColumns: "1.3fr 1fr",
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
          style={{
            fontSize: "clamp(56px, 7.4vw, 112px)",
            lineHeight: 0.96,
            margin: 0,
            color: "var(--ink-hi)",
            letterSpacing: "-0.03em",
          }}
        >
          <HeroRange
            loading={basisLoading}
            error={basisError}
            empty={basisEmpty}
            min={pctMin}
            max={pctMax}
          />
          <br />
          <span style={{ fontStyle: "italic", fontWeight: 300 }}>
            of log-price
            <br />
            variance is
            <br />
            unexplained.
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
            provider identity, commitment type, region, bundled resources
          </span>{" "}
          — a residual this large remains. That residual is the basis risk any
          compute benchmark has to live with.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
          <Link className="btn primary" href="/basis">
            See the decomposition →
          </Link>
          <Link className="btn ghost" href="/methodology">
            Methodology
          </Link>
        </div>
      </div>

      <div className="panel" style={{ padding: 22 }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          Residual share · by day
        </div>
        <ResidualByDay
          loading={basisLoading}
          error={basisError}
          empty={basisEmpty}
          decomps={decomps}
        />
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
          className="grid items-start"
          style={{
            gridTemplateColumns: "1.3fr 1fr",
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

function ResidualByDay({
  loading,
  error,
  empty,
  decomps,
}: {
  loading: boolean;
  error: boolean;
  empty: boolean;
  decomps: BasisDecompositionResponse[];
}) {
  if (loading) {
    return (
      <div className="caption" style={{ padding: "12px 0" }}>
        Loading 3-day residual window…
      </div>
    );
  }
  if (error) {
    return (
      <div
        className="caption"
        style={{ padding: "12px 0", color: "var(--verdict-bad)" }}
      >
        Failed to load basis decomposition.
      </div>
    );
  }
  if (empty || decomps.length === 0) {
    return (
      <div className="caption" style={{ padding: "12px 0" }}>
        No decompositions yet for this SKU.
      </div>
    );
  }

  const sorted = [...decomps].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {sorted.map((d) => (
        <div
          key={d.date}
          className="grid items-center"
          style={{ gridTemplateColumns: "90px 1fr 64px", gap: 14 }}
        >
          <span
            className="mono"
            style={{ fontSize: 11, color: "var(--ink-dim)" }}
          >
            {d.date}
          </span>
          <div
            style={{
              height: 22,
              background: "var(--panel-hi)",
              borderRadius: 2,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                bottom: 0,
                width: `${Math.max(0, Math.min(100, d.pct_residual))}%`,
                background: "var(--residual)",
              }}
            />
          </div>
          <span
            className="mono"
            style={{
              fontSize: 13,
              color: "var(--residual)",
              textAlign: "right",
            }}
          >
            {d.pct_residual.toFixed(1)}%
          </span>
        </div>
      ))}
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
          fontSize: 20,
          color: dim ? "var(--ink-dim)" : "var(--ink-hi)",
          letterSpacing: "-0.01em",
        }}
      >
        {display}
      </div>
    </div>
  );
}
