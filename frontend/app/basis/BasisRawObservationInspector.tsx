"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { getRawObservation, getRawObservationExplain } from "@/lib/api";
import { providerLabel } from "@/lib/providerLabel";
import type {
  BundleExtractionExplanation,
  CommitmentCanonicalizationExplanation,
  GpuCanonicalizationExplanation,
  RawObservationDetail,
  RawObservationExplainResponse,
  RegionNormalizationExplanation,
} from "@/lib/types";

type Status = "ok" | "warn" | "unknown";

export function BasisRawObservationInspector({
  rawObservationId,
  open,
  onClose,
}: {
  rawObservationId: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const rawQuery = useQuery({
    queryKey: ["basis-raw-observation", rawObservationId],
    queryFn: () => getRawObservation(rawObservationId!),
    enabled: open && rawObservationId != null,
  });

  const explainQuery = useQuery({
    queryKey: ["basis-raw-observation-explain", rawObservationId],
    queryFn: () => getRawObservationExplain(rawObservationId!),
    enabled: open && rawObservationId != null,
  });

  const [mounted, setMounted] = useState(false);
  const [domReady, setDomReady] = useState(false);

  useEffect(() => {
    setDomReady(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setMounted(false);
      return;
    }
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || rawObservationId == null || !domReady) return null;

  const inspector = (
    <>
      <div
        className="fixed inset-0 z-[60] bg-[rgba(31,29,26,0.45)] transition-opacity duration-200"
        style={{ opacity: mounted ? 1 : 0 }}
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label={`Raw observation ${rawObservationId}`}
        className="fixed inset-0 z-[70] flex flex-col overflow-hidden rounded-none border border-[var(--line-hi)] bg-[var(--bg)] shadow-2xl md:inset-10 md:rounded-[8px]"
        style={{
          transform: mounted ? "translateY(0)" : "translateY(8px)",
          opacity: mounted ? 1 : 0,
          transition:
            "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease",
        }}
      >
        <InspectorHeader
          rawObservationId={rawObservationId}
          raw={rawQuery.data ?? null}
          onClose={onClose}
        />

        <div
          className="flex-1 overflow-y-auto"
          style={{ minHeight: 0 }}
        >
          {rawQuery.isLoading || explainQuery.isLoading ? (
            <div className="p-6">
              <InspectorState
                title="Loading raw observation…"
                body="Fetching the immutable payload and its normalization explanations."
              />
            </div>
          ) : rawQuery.isError || explainQuery.isError ? (
            <div className="p-6">
              <InspectorState
                title="Failed to load raw observation."
                body={
                  (rawQuery.error as Error | undefined)?.message ??
                  (explainQuery.error as Error | undefined)?.message ??
                  "unknown error"
                }
                tone="error"
              />
            </div>
          ) : rawQuery.data && explainQuery.data ? (
            <InspectorBody raw={rawQuery.data} explain={explainQuery.data} />
          ) : (
            <div className="p-6">
              <InspectorState
                title="Raw observation unavailable."
                body="The audit trail did not return any data for this raw observation."
              />
            </div>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(inspector, document.body);
}

function InspectorHeader({
  rawObservationId,
  raw,
  onClose,
}: {
  rawObservationId: number;
  raw: RawObservationDetail | null;
  onClose: () => void;
}) {
  return (
    <header className="border-b border-[var(--line-lo)] px-4 py-4 md:px-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow mb-1">Raw observation</div>
          <h2 className="serif m-0 text-[22px] font-normal text-[var(--ink-hi)]">
            Audit trail for{" "}
            <span className="mono text-[var(--ink)]">#{rawObservationId}</span>
          </h2>
          <div className="caption mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>How this row was normalized: reported fields, the rule that fired, and the canonical result.</span>
            {raw && (
              <>
                <span className="text-[var(--ink-faint)]">·</span>
                <span className="mono text-[var(--ink-mid)]">
                  {providerLabel(raw.source)}
                </span>
                <span className="text-[var(--ink-faint)]">·</span>
                <span className="mono text-[var(--ink-mid)]">
                  {raw.collected_at}
                </span>
              </>
            )}
          </div>
        </div>
        <button type="button" className="btn ghost shrink-0" onClick={onClose}>
          Back
        </button>
      </div>
    </header>
  );
}

function InspectorBody({
  raw,
  explain,
}: {
  raw: RawObservationDetail;
  explain: RawObservationExplainResponse;
}) {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <QuoteStrip raw={raw} explain={explain} />

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="serif m-0 text-[16px] font-normal text-[var(--ink)]">
            Normalization pipeline
          </h3>
          <span className="eyebrow">4 stages · sequential</span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))]">
          <PipelineStage
            step={1}
            label="GPU"
            status={gpuStatus(explain.gpu)}
            from={explain.gpu.reported_name}
            to={explain.gpu.canonical_sku}
            meta={gpuMeta(explain.gpu)}
            trail={explain.gpu.rules}
          />
          <PipelineStage
            step={2}
            label="Commitment"
            status={commitmentStatus(explain.commitment)}
            from={explain.commitment.reported_type}
            to={explain.commitment.canonical_type}
            meta={[`rule: ${explain.commitment.rule}`]}
            trail={
              explain.commitment.matched_key
                ? [`matched key: ${explain.commitment.matched_key}`]
                : []
            }
          />
          <PipelineStage
            step={3}
            label="Region"
            status={regionStatus(explain.region)}
            from={explain.region.region_reported}
            to={formatRegionResult(explain.region)}
            meta={[`branch: ${explain.region.branch}`]}
            trail={explain.region.trail}
          />
          <PipelineStage
            step={4}
            label="Bundle"
            status={bundleStatus(explain.bundle)}
            from={"provider payload"}
            to={formatBundleResult(explain.bundle)}
            meta={[`branch: ${explain.bundle.branch}`]}
            trail={[]}
          >
            {explain.bundle.fields.length > 0 && (
              <BundleFieldTable fields={explain.bundle.fields} />
            )}
          </PipelineStage>
        </div>
      </section>

      <section className="grid gap-3">
        <CollapsibleJsonPanel
          title="raw_payload"
          subtitle="Untouched provider response: what the collector saw"
          value={raw.raw_payload}
        />
        {raw.provider_metadata && (
          <CollapsibleJsonPanel
            title="provider_metadata"
            subtitle="Auxiliary fields kept alongside the raw payload"
            value={raw.provider_metadata}
          />
        )}
      </section>
    </div>
  );
}

function QuoteStrip({
  raw,
  explain,
}: {
  raw: RawObservationDetail;
  explain: RawObservationExplainResponse;
}) {
  const price = raw.price_hourly;
  const canonicalSku =
    explain.gpu.canonical_sku ?? raw.gpu_model_reported;

  return (
    <section className="panel">
      <div className="grid items-stretch gap-0 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <QuoteCell label="Price" emphasis>
          <span className="num text-[28px] leading-none text-[var(--ink-hi)]">
            ${price.toFixed(4)}
          </span>
          <span className="caption ml-1">/ GPU hr</span>
        </QuoteCell>
        <QuoteCell label="Source">
          <span className="text-[15px] text-[var(--ink-hi)]">
            {providerLabel(raw.source)}
          </span>
          <span className="caption mono">{raw.source}</span>
        </QuoteCell>
        <QuoteCell label="Reported GPU">
          <span className="text-[14px] text-[var(--ink)]">
            {raw.gpu_model_reported}
          </span>
          <span className="mono text-[11px] text-[var(--ink-dim)]">
            → {canonicalSku}
          </span>
        </QuoteCell>
        <QuoteCell label="Reported region">
          {raw.region_reported ? (
            <span className="mono text-[12px] text-[var(--ink)]">
              {raw.region_reported}
            </span>
          ) : (
            <span className="pill-unknown">UNKNOWN</span>
          )}
          <span className="mono text-[11px] text-[var(--ink-dim)]">
            commitment: {raw.commitment_type_reported ?? "-"}
          </span>
        </QuoteCell>
      </div>
    </section>
  );
}

function QuoteCell({
  label,
  emphasis = false,
  children,
}: {
  label: string;
  emphasis?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-1.5 border-b border-[var(--line-lo)] px-5 py-4 md:border-b-0 md:border-r last:md:border-r-0"
      style={{
        background: emphasis ? "var(--panel-hi)" : "transparent",
      }}
    >
      <div className="eyebrow">{label}</div>
      <div className="flex min-h-[24px] flex-wrap items-baseline gap-x-2">
        {children}
      </div>
    </div>
  );
}

function PipelineStage({
  step,
  label,
  status,
  from,
  to,
  meta,
  trail,
  children,
}: {
  step: number;
  label: string;
  status: Status;
  from: string | null;
  to: string | null;
  meta: string[];
  trail: string[];
  children?: React.ReactNode;
}) {
  return (
    <article className="panel flex min-w-0 flex-col gap-3 p-4 [overflow-wrap:anywhere]">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="stage-index">{step}</span>
          <span className="text-[14px] text-[var(--ink-hi)]">{label}</span>
        </div>
        <StatusPill status={status} />
      </header>

      <div className="flow-row">
        <FlowValue value={from} muted />
        <span className="flow-arrow" aria-hidden="true">
          →
        </span>
        <FlowValue value={to} />
      </div>

      {meta.length > 0 && (
        <ul className="m-0 flex flex-wrap gap-x-3 gap-y-1 p-0">
          {meta.map((line) => (
            <li
              key={line}
              className="mono text-[11px] text-[var(--ink-dim)] list-none"
            >
              {line}
            </li>
          ))}
        </ul>
      )}

      {trail.length > 0 && (
        <details className="trail-details">
          <summary className="caption cursor-pointer select-none">
            {trail.length} rule {trail.length === 1 ? "step" : "steps"}
          </summary>
          <ol className="caption mt-2 m-0 list-decimal space-y-1 pl-5">
            {trail.map((step, i) => (
              <li key={`${i}-${step}`}>{step}</li>
            ))}
          </ol>
        </details>
      )}

      {children}
    </article>
  );
}

function FlowValue({
  value,
  muted = false,
}: {
  value: string | null;
  muted?: boolean;
}) {
  if (value === null || value === "" || value === undefined) {
    return <span className="pill-unknown">UNKNOWN</span>;
  }
  return (
    <span
      className="mono text-[12px] break-words"
      style={{ color: muted ? "var(--ink-mid)" : "var(--ink-hi)" }}
    >
      {value}
    </span>
  );
}

function StatusPill({ status }: { status: Status }) {
  const cfg: Record<Status, { glyph: string; label: string; cls: string }> = {
    ok: { glyph: "✓", label: "Canonicalized", cls: "status-pill ok" },
    warn: { glyph: "△", label: "Partial", cls: "status-pill warn" },
    unknown: { glyph: "✕", label: "Unknown", cls: "status-pill bad" },
  };
  const c = cfg[status];
  return (
    <span className={c.cls}>
      <span aria-hidden="true">{c.glyph}</span>
      <span>{c.label}</span>
    </span>
  );
}

function BundleFieldTable({
  fields,
}: {
  fields: BundleExtractionExplanation["fields"];
}) {
  return (
    <div className="border-t border-[var(--line-lo)] pt-3">
      <div className="eyebrow mb-2">Field provenance</div>
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Canonical</th>
              <th>Source field</th>
              <th>Transformation</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field.canonical_field}>
                <td className="mono text-[11px] text-[var(--ink)]">
                  {field.canonical_field}
                </td>
                <td className="mono text-[11px] text-[var(--ink-mid)]">
                  {field.source_field ?? "-"}
                </td>
                <td className="caption">{field.transformation ?? "-"}</td>
                <td className="mono text-[11px] text-[var(--ink)]">
                  {formatResult(field.result)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CollapsibleJsonPanel({
  title,
  subtitle,
  value,
}: {
  title: string;
  subtitle: string;
  value: Record<string, unknown>;
}) {
  const [open, setOpen] = useState(false);
  const keyCount = Object.keys(value).length;
  return (
    <section className="panel overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--panel-hi)]"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="eyebrow">{title}</div>
          <div className="caption mt-0.5">{subtitle}</div>
        </div>
        <span className="mono text-[11px] text-[var(--ink-dim)]">
          {keyCount} {keyCount === 1 ? "key" : "keys"} {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <pre className="mono m-0 max-h-[400px] overflow-y-auto whitespace-pre-wrap [overflow-wrap:anywhere] border-t border-[var(--line-lo)] px-4 py-4 text-[11px] leading-[1.55] text-[var(--ink-mid)]">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </section>
  );
}

function InspectorState({
  title,
  body,
  tone = "muted",
}: {
  title: string;
  body: string;
  tone?: "muted" | "error";
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

// --- status helpers ---

function gpuStatus(exp: GpuCanonicalizationExplanation): Status {
  if (exp.canonical_sku) return "ok";
  return "unknown";
}

function commitmentStatus(
  exp: CommitmentCanonicalizationExplanation,
): Status {
  if (exp.canonical_type === "unknown" || exp.canonical_type === "UNKNOWN") {
    return "unknown";
  }
  if (!exp.reported_type) return "warn";
  return "ok";
}

function regionStatus(exp: RegionNormalizationExplanation): Status {
  if (!exp.country) return "unknown";
  if (!exp.state && !exp.city) return "warn";
  return "ok";
}

function bundleStatus(exp: BundleExtractionExplanation): Status {
  const populated = [exp.vcpus, exp.ram_gb, exp.storage_gb].filter(
    (v) => v != null,
  ).length;
  if (populated === 0) return "unknown";
  if (populated < 3) return "warn";
  return "ok";
}

function gpuMeta(exp: GpuCanonicalizationExplanation): string[] {
  const meta: string[] = [];
  if (exp.gpu_variant) meta.push(`variant: ${exp.gpu_variant}`);
  if (exp.vram_gb != null) meta.push(`vram: ${exp.vram_gb} GB`);
  return meta;
}

function formatRegionResult(exp: RegionNormalizationExplanation): string | null {
  const parts: string[] = [];
  if (exp.country) parts.push(exp.country);
  if (exp.state) parts.push(exp.state);
  if (exp.city) parts.push(exp.city);
  return parts.length ? parts.join(" · ") : null;
}

function formatBundleResult(exp: BundleExtractionExplanation): string | null {
  const parts: string[] = [];
  if (exp.vcpus != null) parts.push(`${exp.vcpus} vCPU`);
  if (exp.ram_gb != null) parts.push(`${exp.ram_gb} GB RAM`);
  if (exp.storage_gb != null) parts.push(`${Math.round(exp.storage_gb)} GB disk`);
  if (exp.verification_tier) parts.push(exp.verification_tier);
  return parts.length ? parts.join(" · ") : null;
}

function formatResult(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return JSON.stringify(value);
}
