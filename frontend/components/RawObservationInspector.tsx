"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRawObservation, getRawObservationExplain } from "@/lib/api";
import type {
  BundleExtractionExplanation,
  CommitmentCanonicalizationExplanation,
  GpuCanonicalizationExplanation,
  RegionNormalizationExplanation,
} from "@/lib/types";

/**
 * Modal that shows the full audit trail for a single raw observation:
 *   raw payload (JSONB)  +  per-module normalization explanations.
 *
 * Rendered on top of ObservationsDrawer; closes independently via Esc
 * or the Back button.
 */
export function RawObservationInspector({
  rawObservationId,
  open,
  onClose,
}: {
  rawObservationId: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const rawQuery = useQuery({
    queryKey: ["raw-observation", rawObservationId],
    queryFn: () => getRawObservation(rawObservationId!),
    enabled: open && rawObservationId != null,
  });

  const explainQuery = useQuery({
    queryKey: ["raw-observation-explain", rawObservationId],
    queryFn: () => getRawObservationExplain(rawObservationId!),
    enabled: open && rawObservationId != null,
  });

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open || rawObservationId == null) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/80"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label={`Raw observation ${rawObservationId}`}
        className="fixed inset-4 z-[70] flex flex-col overflow-hidden rounded-md border border-gray-800 bg-gray-950 shadow-2xl md:inset-10"
      >
        <header className="flex items-baseline justify-between border-b border-gray-800 px-6 py-4">
          <div>
            <h2 className="text-sm font-medium text-gray-100">
              Raw observation{" "}
              <span className="font-mono text-gray-400">#{rawObservationId}</span>
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Full provider payload and per-module normalization trail
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-gray-800 px-3 py-1 text-xs text-gray-400 hover:border-gray-700 hover:text-gray-200"
          >
            Back
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {(rawQuery.isLoading || explainQuery.isLoading) && (
            <div className="p-8 text-sm text-gray-500">Loading observation…</div>
          )}
          {(rawQuery.isError || explainQuery.isError) && (
            <div className="p-8 text-sm text-red-300">
              Failed to load: {(rawQuery.error as Error)?.message ??
                (explainQuery.error as Error)?.message ??
                "unknown error"}
            </div>
          )}
          {rawQuery.data && explainQuery.data && (
            <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <RawPanel
                source={rawQuery.data.source}
                collectedAt={rawQuery.data.collected_at}
                gpuReported={rawQuery.data.gpu_model_reported}
                regionReported={rawQuery.data.region_reported}
                commitmentReported={rawQuery.data.commitment_type_reported}
                priceHourly={rawQuery.data.price_hourly}
                rawPayload={rawQuery.data.raw_payload}
                providerMetadata={rawQuery.data.provider_metadata}
              />
              <ExplainPanel
                gpu={explainQuery.data.gpu}
                commitment={explainQuery.data.commitment}
                region={explainQuery.data.region}
                bundle={explainQuery.data.bundle}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function RawPanel({
  source,
  collectedAt,
  gpuReported,
  regionReported,
  commitmentReported,
  priceHourly,
  rawPayload,
  providerMetadata,
}: {
  source: string;
  collectedAt: string;
  gpuReported: string;
  regionReported: string | null;
  commitmentReported: string | null;
  priceHourly: number;
  rawPayload: Record<string, unknown>;
  providerMetadata: Record<string, unknown> | null;
}) {
  return (
    <section>
      <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">
        Raw observation
      </h3>
      <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 rounded-md border border-gray-800 bg-gray-900/40 px-4 py-3 text-xs">
        <Field label="source" value={source} mono />
        <Field label="collected_at" value={collectedAt} mono />
        <Field label="gpu_model_reported" value={gpuReported} mono />
        <Field label="region_reported" value={regionReported ?? "—"} mono />
        <Field label="commitment_type_reported" value={commitmentReported ?? "—"} mono />
        <Field label="price_hourly" value={`$${priceHourly.toFixed(4)}`} mono />
      </dl>

      <h4 className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-500">
        raw_payload
      </h4>
      <pre className="mt-2 overflow-x-auto rounded-md border border-gray-800 bg-gray-950 px-3 py-2 font-mono text-[11px] text-gray-300">
        {JSON.stringify(rawPayload, null, 2)}
      </pre>

      {providerMetadata && (
        <>
          <h4 className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-500">
            provider_metadata
          </h4>
          <pre className="mt-2 overflow-x-auto rounded-md border border-gray-800 bg-gray-950 px-3 py-2 font-mono text-[11px] text-gray-300">
            {JSON.stringify(providerMetadata, null, 2)}
          </pre>
        </>
      )}
    </section>
  );
}

function ExplainPanel({
  gpu,
  commitment,
  region,
  bundle,
}: {
  gpu: GpuCanonicalizationExplanation;
  commitment: CommitmentCanonicalizationExplanation;
  region: RegionNormalizationExplanation;
  bundle: BundleExtractionExplanation;
}) {
  return (
    <section>
      <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">
        Normalization trail
      </h3>
      <div className="mt-2 space-y-4">
        <GpuSection exp={gpu} />
        <CommitmentSection exp={commitment} />
        <RegionSection exp={region} />
        <BundleSection exp={bundle} />
      </div>
    </section>
  );
}

function GpuSection({ exp }: { exp: GpuCanonicalizationExplanation }) {
  return (
    <ExplainBlock title="GPU canonicalization">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs">
        <Field label="reported_name" value={exp.reported_name} mono />
        <Field
          label="canonical_sku"
          value={exp.canonical_sku ?? <UnknownLabel text="unmapped" />}
          mono
        />
        <Field label="gpu_variant" value={exp.gpu_variant ?? "—"} mono />
        <Field label="vram_gb" value={exp.vram_gb?.toString() ?? "—"} mono />
      </dl>
      <Trail steps={exp.rules} />
    </ExplainBlock>
  );
}

function CommitmentSection({ exp }: { exp: CommitmentCanonicalizationExplanation }) {
  return (
    <ExplainBlock title="Commitment canonicalization">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs">
        <Field label="reported_type" value={exp.reported_type ?? "—"} mono />
        <Field label="canonical_type" value={exp.canonical_type} mono />
        <Field label="rule" value={exp.rule} mono />
        <Field label="matched_key" value={exp.matched_key ?? "—"} mono />
      </dl>
    </ExplainBlock>
  );
}

function RegionSection({ exp }: { exp: RegionNormalizationExplanation }) {
  return (
    <ExplainBlock title="Region normalization">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs">
        <Field label="branch" value={exp.branch} mono />
        <Field label="region_reported" value={exp.region_reported ?? "—"} mono />
        <Field label="country" value={exp.country ?? <UnknownLabel />} mono />
        <Field label="state" value={exp.state ?? "—"} mono />
        <Field label="city" value={exp.city ?? "—"} mono />
      </dl>
      <Trail steps={exp.trail} />
    </ExplainBlock>
  );
}

function BundleSection({ exp }: { exp: BundleExtractionExplanation }) {
  return (
    <ExplainBlock title="Bundle extraction">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs">
        <Field label="branch" value={exp.branch} mono />
        <Field label="vcpus" value={exp.vcpus?.toString() ?? "—"} mono />
        <Field label="ram_gb" value={exp.ram_gb?.toString() ?? "—"} mono />
        <Field label="storage_gb" value={exp.storage_gb?.toString() ?? "—"} mono />
        <Field label="verification_tier" value={exp.verification_tier ?? "—"} mono />
      </dl>
      {exp.fields.length > 0 && (
        <table className="mt-2 w-full text-[11px]">
          <thead className="text-gray-500">
            <tr>
              <th className="text-left font-medium">canonical</th>
              <th className="text-left font-medium">source field</th>
              <th className="text-left font-medium">transformation</th>
              <th className="text-left font-medium">result</th>
            </tr>
          </thead>
          <tbody>
            {exp.fields.map((f) => (
              <tr key={f.canonical_field} className="border-t border-gray-800 align-top">
                <td className="py-1 pr-3 font-mono text-gray-300">{f.canonical_field}</td>
                <td className="py-1 pr-3 font-mono text-gray-400">
                  {f.source_field ?? "—"}
                </td>
                <td className="py-1 pr-3 text-gray-400">{f.transformation ?? "—"}</td>
                <td className="py-1 font-mono text-gray-300">
                  {formatResult(f.result)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ExplainBlock>
  );
}

function formatResult(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return JSON.stringify(v);
}

function ExplainBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-gray-800 bg-gray-900/40 px-4 py-3">
      <div className="text-xs font-medium text-gray-300">{title}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <>
      <dt className="text-gray-500">{label}</dt>
      <dd className={mono ? "font-mono text-gray-300" : "text-gray-300"}>{value}</dd>
    </>
  );
}

function Trail({ steps }: { steps: string[] }) {
  if (steps.length === 0) return null;
  return (
    <ol className="mt-2 space-y-0.5 text-[11px] text-gray-400">
      {steps.map((s, i) => (
        <li key={i} className="font-mono">
          <span className="text-gray-600">{i + 1}. </span>
          {s}
        </li>
      ))}
    </ol>
  );
}

function UnknownLabel({ text = "unknown" }: { text?: string }) {
  return (
    <span className="rounded-sm bg-rose-950/50 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-rose-300">
      {text}
    </span>
  );
}
