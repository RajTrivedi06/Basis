"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type DecompShares } from "@/components/charts/DecompBar";
import { LedgerWaterfall } from "@/components/charts/LedgerWaterfall";
import { SkuPicker } from "@/components/SkuPicker";
import { TwoLayer } from "@/components/disclosure/TwoLayer";
import { GlossaryTerm } from "@/components/glossary/GlossaryTerm";
import { getBasisDecomposition, getDecompositionObservations, getDispersion } from "@/lib/api";
import { factorColor, type Factor } from "@/lib/factorColor";
import { useSku } from "@/lib/useSku";
import type { BasisDecompositionResponse } from "@/lib/types";
import { BasisObservationsDrawer } from "./BasisObservationsDrawer";
import { BasisRawObservationInspector } from "./BasisRawObservationInspector";
import { BeeswarmReceipt } from "./BeeswarmReceipt";
import { pointsFromObservations } from "./factorPoints";

const SWARM_TABS: { factor: Factor; label: string }[] = [
  { factor: "region", label: "Region" },
  { factor: "commitment", label: "Commitment" },
  { factor: "provider", label: "Provider" },
  { factor: "bundle", label: "Bundle" },
  { factor: "residual", label: "Residual (within cell)" },
];

type FactorKey = Exclude<Factor, "residual">;

type FactorRow = {
  key: Factor;
  label: string;
  share: number;
  cumulative: number;
  note: string;
};

const FACTOR_META: {
  key: FactorKey;
  label: string;
  note: string;
}[] = [
  {
    key: "region",
    label: "Region",
    note: "Country and locality groupings preserved from the normalized quote.",
  },
  {
    key: "commitment",
    label: "Commitment",
    note: "On-demand, spot, or reserved terms observed on that collection day.",
  },
  {
    key: "provider",
    label: "Provider",
    note: "Identity of the public price source, after region and commitment.",
  },
  {
    key: "bundle",
    label: "Bundle",
    note: "Bundled vCPU, RAM, and storage quartile that traveled with the GPU.",
  },
];

export function BasisPageClient() {
  const { sku, setSku } = useSku();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inspectingId, setInspectingId] = useState<number | null>(null);
  const [swarmFactor, setSwarmFactor] = useState<Factor>("provider");

  const basisQuery = useQuery({
    queryKey: ["basis", sku],
    queryFn: () => getBasisDecomposition(sku),
  });

  const dispersionQuery = useQuery({
    queryKey: ["dispersion", sku],
    queryFn: () => getDispersion(sku),
  });

  const decomposition = basisQuery.data ?? null;
  const observationsQuery = useQuery({
    queryKey: ["decomposition-observations", sku, decomposition?.date],
    queryFn: () =>
      getDecompositionObservations(sku, decomposition?.date ? { date: decomposition.date } : undefined),
    enabled: !!decomposition?.date,
  });

  const sampleDates = (dispersionQuery.data?.points ?? [])
    .map((point) => point.date)
    .sort()
    .slice(-3);
  const windowLabel =
    sampleDates.length > 0 ? `${sampleDates.length}-day sample` : "Current sample";

  const basisMessage = getBasisMessage(basisQuery.error);
  const basisState =
    basisQuery.isLoading
      ? "loading"
      : basisQuery.isError
        ? basisMessage.tone === "muted"
          ? "empty"
          : "error"
        : !decomposition
          ? "empty"
          : "ready";

  const shares = decomposition ? toDecompShares(decomposition) : null;
  const factorRows = useMemo(
    () => (shares ? buildFactorRows(shares) : []),
    [shares]
  );

  // Swarm points are derived from the same contributing-offers payload the
  // drawer uses. Recomputed on factor change so the bundle bin edges reflect
  // the current selection's distribution.
  const swarmPoints = useMemo(
    () => pointsFromObservations(swarmFactor, observationsQuery.data?.items ?? []),
    [swarmFactor, observationsQuery.data]
  );

  return (
    <div className="page-wide fade-up">
      <section
        className="border-b border-[var(--line-lo)] pb-5 pt-9"
      >
        <div
          className="grid items-end gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,320px)]"
        >
          <div>
            <div className="eyebrow mb-2.5">
              03 · Basis decomposition · {windowLabel}
            </div>
            <h1 className="display m-0 max-w-[920px] text-[clamp(2.25rem,5vw,3rem)] font-normal leading-[1.05] tracking-[-0.02em] text-[var(--ink-hi)]">
              What share of log-price variance do{" "}
              <em className="font-serif not-italic text-[var(--ink-mid)]">
                observable factors
              </em>{" "}
              explain?
            </h1>
            <TwoLayer
              className="mt-5"
              plain={
                <>
                  Prices for the same chip disagree. This page names the causes
                  we can see — where it is, how it is rented, who is renting it,
                  what came bundled with it — and measures what is left after
                  all four.
                </>
              }
            >
              <p>
                The ledger and table below are the latest daily{" "}
                <GlossaryTerm term="decomposition">decomposition</GlossaryTerm>{" "}
                for the selected SKU, in the model order{" "}
                <span className="mono text-[var(--ink)]">
                  region → commitment → provider → bundle → residual
                </span>
                , so the cumulative percentages match the backend&apos;s
                sequential ANOVA.
              </p>
              <p>
                Order matters for the four factors and not for the last one.
                Each factor is credited only with what it explains after the
                factors before it have had their turn, so reordering them moves
                credit between them — but the{" "}
                <GlossaryTerm term="residual">residual</GlossaryTerm> at the end
                is the same either way. That is what makes it worth reporting.
              </p>
            </TwoLayer>
          </div>

          <BasisMetaRail
            sku={sku}
            date={decomposition?.date ?? null}
            dateLoading={basisQuery.isLoading}
            dateError={basisState === "error"}
            offerCount={
              observationsQuery.data ? observationsQuery.data.items.length : null
            }
            offersLoading={observationsQuery.isLoading}
            offersError={observationsQuery.isError}
          />
        </div>
      </section>

      <section className="pt-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="caption mono uppercase tracking-[0.1em]">
            GPU SKU
          </span>
          <SkuPicker value={sku} onChange={setSku} />
        </div>

        {basisState === "ready" && shares && decomposition ? (
          <div className="panel p-[18px]">
            <LedgerWaterfall decomposition={decomposition} glanceLabel={sku} />
            <p className="caption mt-4 max-w-[760px]">
              The ledger is read as shares of total log-price variance{" "}
              <span className="mono text-[var(--ink)]">
                ({decomposition.total_variance.toFixed(4)})
              </span>
              . Observable factors account for{" "}
              <span className="mono text-[var(--ink)]">
                {decomposition.pct_explained.toFixed(1)}%
              </span>
              ; the remaining{" "}
              <span className="mono" style={{ color: "var(--residual)" }}>
                {decomposition.pct_residual.toFixed(1)}%
              </span>{" "}
              is residual basis risk.
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                className="btn ghost"
                onClick={() => setDrawerOpen(true)}
              >
                View contributing observations →
              </button>
            </div>
          </div>
        ) : (
          <StatePanel
            title={
              basisState === "loading"
                ? "Loading decomposition…"
                : basisState === "error"
                  ? "Failed to load decomposition."
                  : "No decomposition available."
            }
            body={
              basisState === "loading"
                ? "Fetching the latest daily attribution for this SKU."
                : basisMessage.message
            }
            tone={basisState === "error" ? "error" : "muted"}
          />
        )}
      </section>

      <section className="pt-10">
        <div className="sec-eyebrow">
          <span className="num">02</span>
          <h2>Factor contributions</h2>
        </div>

        {basisState === "ready" && factorRows.length > 0 ? (
          <div className="panel overflow-hidden">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 200 }}>Factor</th>
                  <th className="text-right" style={{ width: 120 }}>
                    Share
                  </th>
                  <th style={{ width: 260 }}>Cumulative %</th>
                  <th>Interpretation</th>
                  <th style={{ width: 96 }} />
                </tr>
              </thead>
              <tbody>
                {factorRows.map((row) => (
                  <FactorContributionRow
                    key={row.key}
                    row={row}
                    onInspect={() => setDrawerOpen(true)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <StatePanel
            title={
              basisState === "loading"
                ? "Loading factor table…"
                : basisState === "error"
                  ? "Factor table unavailable."
                  : "No factor contributions yet."
            }
            body={
              basisState === "loading"
                ? "The factor table appears once the daily decomposition has loaded."
                : basisMessage.message
            }
            tone={basisState === "error" ? "error" : "muted"}
          />
        )}
      </section>

      <section className="pt-10">
        <div className="sec-eyebrow">
          <span className="num">03</span>
          <h2>Price by factor</h2>
        </div>
        <p className="caption mt-3 mb-4 max-w-[760px]">
          Per-offer prices laid out by a single factor, one row per group. Tight
          rows mean the factor explains the spread; broad rows mean it
          doesn&apos;t. The{" "}
          <span className="mono text-[var(--ink)]">Residual (within cell)</span>{" "}
          view conditions on{" "}
          <span className="mono text-[var(--ink)]">(provider × commitment)</span>{" "}
          — within-row spread is the basis risk observable factors cannot
          capture. Every dot is a real offer; select one to file its receipt.
        </p>
        <div className="panel p-[18px]">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="mono text-[10px] uppercase tracking-[0.1em] text-[var(--ink-dim)]">
              Factor
            </span>
            {SWARM_TABS.map((tab) => (
              <button
                key={tab.factor}
                type="button"
                className={`chip${swarmFactor === tab.factor ? " on" : ""}`}
                onClick={() => setSwarmFactor(tab.factor)}
                aria-pressed={swarmFactor === tab.factor}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {observationsQuery.isLoading ? (
            <StatePanel
              title="Loading observations…"
              body="Fetching the canonical offers that fed the current decomposition."
              tone="muted"
            />
          ) : observationsQuery.isError ? (
            <StatePanel
              title="Failed to load observations."
              body={
                (observationsQuery.error as Error | undefined)?.message ??
                "unknown error"
              }
              tone="error"
            />
          ) : swarmPoints.length > 0 ? (
            <BeeswarmReceipt
              factor={swarmFactor}
              points={swarmPoints}
              gpuSku={sku}
              onInspect={(id) => setInspectingId(id)}
            />
          ) : (
            <StatePanel
              title="No observations to plot."
              body="The contributing-offer endpoint returned no canonical offers for this decomposition."
              tone="muted"
            />
          )}
        </div>
      </section>

      <BasisObservationsDrawer
        gpuSku={sku}
        date={decomposition?.date ?? null}
        open={drawerOpen}
        suspendEscape={inspectingId != null}
        onClose={() => setDrawerOpen(false)}
        onInspect={(id) => setInspectingId(id)}
      />
      <BasisRawObservationInspector
        rawObservationId={inspectingId}
        open={inspectingId != null}
        onClose={() => setInspectingId(null)}
      />
    </div>
  );
}

function BasisMetaRail({
  sku,
  date,
  dateLoading,
  dateError,
  offerCount,
  offersLoading,
  offersError,
}: {
  sku: string;
  date: string | null;
  dateLoading: boolean;
  dateError: boolean;
  offerCount: number | null;
  offersLoading: boolean;
  offersError: boolean;
}) {
  return (
    <div className="panel p-[18px]">
      <div className="grid gap-4">
        <MetaStat
          label="Latest decomposition"
          value={date}
          loading={dateLoading}
          error={dateError}
        />
        <MetaStat
          label="Contributing offers"
          value={offerCount === null ? null : offerCount.toLocaleString()}
          loading={offersLoading}
          error={offersError}
        />
        <MetaStat label="SKU" value={sku} mono />
      </div>
    </div>
  );
}

function MetaStat({
  label,
  value,
  loading = false,
  error = false,
  mono = true,
}: {
  label: string;
  value: string | null;
  loading?: boolean;
  error?: boolean;
  mono?: boolean;
}) {
  const display = loading ? "…" : error || value === null ? "—" : value;
  const color =
    loading || error || value === null ? "var(--ink-dim)" : "var(--ink-hi)";

  return (
    <div>
      <div className="eyebrow mb-1">{label}</div>
      <div
        className={mono ? "mono" : undefined}
        style={{
          fontSize: 16,
          letterSpacing: "-0.01em",
          color,
        }}
      >
        {display}
      </div>
    </div>
  );
}

function StatePanel({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: "muted" | "error";
}) {
  return (
    <div className="panel p-[18px]">
      <div
        className="mono text-[12px] uppercase tracking-[0.1em]"
        style={{
          color: tone === "error" ? "var(--verdict-bad)" : "var(--ink-mid)",
        }}
      >
        {title}
      </div>
      <p className="caption mb-0 mt-3 max-w-[720px] leading-relaxed">
        {body}
      </p>
    </div>
  );
}

function FactorContributionRow({
  row,
  onInspect,
}: {
  row: FactorRow;
  onInspect: () => void;
}) {
  const isResidual = row.key === "residual";
  const color = isResidual ? "var(--residual)" : factorColor(row.key);
  const labelColor = isResidual ? "var(--residual)" : "var(--ink)";
  const shareTextColor = isResidual ? "var(--residual)" : "var(--ink)";
  const rowBackground = isResidual
    ? "color-mix(in srgb, var(--residual) 4%, transparent)"
    : "transparent";

  return (
    <tr style={{ background: rowBackground }}>
      <td>
        <div className="flex items-center gap-2.5">
          <span
            style={{
              width: isResidual ? 10 : 8,
              height: isResidual ? 10 : 8,
              borderRadius: 1,
              background: color,
            }}
          />
          <span
            className={isResidual ? "mono text-[13px] uppercase tracking-[0.02em]" : undefined}
            style={{ color: labelColor }}
          >
            {row.label}
          </span>
        </div>
      </td>
      <td
        className="num text-right"
        style={{
          color: shareTextColor,
          fontSize: isResidual ? 15 : 14,
          fontWeight: isResidual ? 600 : 400,
        }}
      >
        {(row.share * 100).toFixed(1)}%
      </td>
      <td>
        <div className="grid gap-1.5">
          <span className="mono text-[11px]" style={{ color: "var(--ink-mid)" }}>
            {(row.cumulative * 100).toFixed(1)}%
          </span>
          <div
            style={{
              height: 6,
              background: "var(--panel-hi)",
              borderRadius: 1,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${row.cumulative * 100}%`,
                background: color,
              }}
            />
          </div>
        </div>
      </td>
      <td className="caption leading-relaxed">
        {row.note}
      </td>
      <td className="text-right">
        <button
          type="button"
          className="btn ghost"
          onClick={onInspect}
          style={
            isResidual
              ? {
                  color: "var(--residual)",
                  borderColor: "var(--residual-line)",
                }
              : undefined
          }
        >
          Inspect →
        </button>
      </td>
    </tr>
  );
}

function toDecompShares(data: BasisDecompositionResponse): DecompShares {
  const total = data.total_variance || 1;
  return {
    region: safeShare(data.variance_from_region, total),
    commitment: safeShare(data.variance_from_commitment, total),
    provider: safeShare(data.variance_from_provider, total),
    bundle: safeShare(data.variance_from_bundle, total),
    residual: safeShare(data.residual_variance, total),
  };
}

function safeShare(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }
  return Math.max(0, value / total);
}

function buildFactorRows(shares: DecompShares): FactorRow[] {
  let cumulative = 0;

  const factorRows = FACTOR_META.map((factor) => {
    cumulative += shares[factor.key];
    return {
      key: factor.key,
      label: factor.label,
      share: shares[factor.key],
      cumulative,
      note: factor.note,
    };
  });

  cumulative += shares.residual;
  return [
    ...factorRows,
    {
      key: "residual",
      label: "Residual",
      share: shares.residual,
      cumulative,
      note: "Everything the four observable factors do not explain on that day.",
    },
  ];
}

function getBasisMessage(error: unknown): {
  tone: "muted" | "error";
  message: string;
} {
  const message = (error as Error | undefined)?.message ?? "";
  if (message.startsWith("API 404")) {
    return {
      tone: "muted",
      message:
        "Not enough data yet to decompose this SKU. Basis needs at least five offers on a single day with variation across the modeled factors.",
    };
  }
  if (message) {
    return {
      tone: "error",
      message,
    };
  }
  return {
    tone: "muted",
    message: "No basis decomposition is available for this SKU yet.",
  };
}
