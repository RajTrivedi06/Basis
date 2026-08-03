"use client";

import { useQuery } from "@tanstack/react-query";
import { TwoLayer } from "@/components/disclosure/TwoLayer";
import { GlossaryTerm } from "@/components/glossary/GlossaryTerm";
import {
  EraAnnotationLegend,
  ResidualSeriesChart,
} from "@/components/charts/ResidualSeriesChart";
import { getBasisTimeseries } from "@/lib/api";
import { useSku } from "@/lib/useSku";
import type { BasisDecompositionResponse } from "@/lib/types";

/**
 * "Why pooling misleads" teaching exhibit — design doc Decision #3, copy C19.
 *
 * Both series come from the existing timeseries endpoint: the pooled one reads
 * the precomputed table, the market-priced one asks the same endpoint to drop
 * the two fixed list catalogs. No new analysis and no new endpoint — the point
 * is that one switch produces two very different headline numbers.
 */

// Azure and GCP publish fixed list catalogs; excluding them leaves the
// market-priced segments (marketplaces + spot).
const CATALOG_PROVIDERS = ["azure", "gcp"];

export function PooledExhibit() {
  const { sku } = useSku();

  const pooled = useQuery({
    queryKey: ["basis-timeseries", sku, null, null, null],
    queryFn: () => getBasisTimeseries(sku),
  });

  const marketPriced = useQuery({
    queryKey: [
      "basis-timeseries",
      sku,
      null,
      null,
      `exclude:${CATALOG_PROVIDERS.join(",")}`,
    ],
    queryFn: () =>
      getBasisTimeseries(sku, { excludeProviders: CATALOG_PROVIDERS }),
  });

  const isLoading = pooled.isLoading || marketPriced.isLoading;
  const isError = pooled.isError || marketPriced.isError;
  const pooledPoints = pooled.data?.points ?? [];
  const marketPoints = marketPriced.data?.points ?? [];
  const hasSeries = pooledPoints.length > 0 && marketPoints.length > 0;

  return (
    <>
      <div className="meth-section__head">
        <span className="meth-section__index">09 · Pooling</span>
        <h2 className="meth-section__title">
          Why <em>pooling misleads</em>
        </h2>
        <p className="meth-section__lede">
          Add two fixed price catalogs and the pooled residual collapses —
          while the market keeps moving.
        </p>
      </div>

      <TwoLayer
        plain={
          <>
            The same day, the same SKU, and the same method give two different
            answers depending on which sellers you count.
          </>
        }
      >
        <p>
          Azure and GCP publish administered list catalogs: one posted price per
          instance type, changed rarely. Those quotes are explainable by
          construction — region and commitment account for nearly all of their
          variation — so pooling them with marketplace and{" "}
          <GlossaryTerm term="spot">spot</GlossaryTerm> quotes drags the
          measured <GlossaryTerm term="residual">residual</GlossaryTerm> down
          mechanically, without anything in the market having changed.
        </p>
        <p>
          Both panels below run the identical{" "}
          <GlossaryTerm term="decomposition">decomposition</GlossaryTerm> on the
          identical days. The only difference is the provider set: the left
          keeps every provider, the right drops the two catalogs. Neither is
          wrong — but a benchmark that quotes the pooled figure is reporting the
          composition of its sample, not the state of the market.
        </p>
      </TwoLayer>

      <div className="pooled-exhibit mt-7">
        {isLoading ? (
          <ExhibitState
            title="Loading both series…"
            body="Fetching the pooled and market-priced decompositions for the current SKU."
          />
        ) : isError ? (
          <ExhibitState
            title="Failed to load the comparison."
            body={
              (pooled.error as Error | undefined)?.message ??
              (marketPriced.error as Error | undefined)?.message ??
              "The timeseries endpoint did not answer."
            }
            tone="error"
          />
        ) : !hasSeries ? (
          <ExhibitState
            title="No decomposition available."
            body="The exhibit needs a decomposition history for the current URL SKU on both provider sets."
          />
        ) : (
          <>
            <div className="pooled-exhibit__pair">
              <SeriesPanel
                variant="pooled"
                title="Pooled · every provider"
                note="Includes the Azure and GCP list catalogs."
                points={pooledPoints}
                color="var(--residual-dim)"
                sku={sku}
              />
              <SeriesPanel
                variant="market"
                title="Market-priced · catalogs excluded"
                note="Marketplaces and spot only — the segments the study speaks about."
                points={marketPoints}
                color="var(--residual)"
                sku={sku}
              />
            </div>
            <EraAnnotationLegend />
          </>
        )}
      </div>
    </>
  );
}

function SeriesPanel({
  variant,
  title,
  note,
  points,
  color,
  sku,
}: {
  variant: "pooled" | "market";
  title: string;
  note: string;
  points: BasisDecompositionResponse[];
  color: string;
  sku: string;
}) {
  const latest = points[points.length - 1];

  return (
    <div
      className={`pooled-panel ${
        variant === "pooled" ? "pooled-panel--pooled" : "pooled-panel--market"
      }`}
    >
      <div className="pooled-panel__head">
        <span className="pooled-panel__title">{title}</span>
        <span className="pooled-panel__latest" style={{ color }}>
          {latest.pct_residual.toFixed(1)}% · {latest.date}
        </span>
      </div>

      <ResidualSeriesChart
        points={points}
        color={color}
        ariaLabel={`${title}: unexplained share of ${sku} log-price variance from ${points[0].date} to ${latest.date}, ending at ${latest.pct_residual.toFixed(1)} percent.`}
      />

      <p className="pooled-panel__note">{note}</p>
    </div>
  );
}

function ExhibitState({
  title,
  body,
  tone = "muted",
}: {
  title: string;
  body: string;
  tone?: "muted" | "error";
}) {
  return (
    <div className="panel p-[22px]">
      <div
        className="mono text-[12px] uppercase tracking-[0.1em]"
        style={{
          color: tone === "error" ? "var(--verdict-bad)" : "var(--ink-mid)",
        }}
      >
        {title}
      </div>
      <p className="caption mb-0 mt-3 max-w-[720px] leading-relaxed">{body}</p>
    </div>
  );
}
