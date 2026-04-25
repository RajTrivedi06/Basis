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

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || rawObservationId == null) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/80"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label={`Raw observation ${rawObservationId}`}
        className="fixed inset-4 z-[70] flex flex-col overflow-hidden rounded-[8px] border border-[var(--line-hi)] bg-[var(--bg)] shadow-2xl md:inset-10"
      >
        <header className="border-b border-[var(--line-lo)] px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="eyebrow mb-1">Raw observation</div>
              <h2 className="serif m-0 text-[22px] font-normal text-[var(--ink-hi)]">
                Audit trail for #{rawObservationId}
              </h2>
              <p className="caption mt-2 max-w-[560px]">
                Full provider payload plus the rule-by-rule normalization trail
                that produced the canonical offer.
              </p>
            </div>
            <button type="button" className="btn ghost" onClick={onClose}>
              Back
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {rawQuery.isLoading || explainQuery.isLoading ? (
            <InspectorState
              title="Loading raw observation…"
              body="Fetching the immutable payload and its normalization explanations."
            />
          ) : rawQuery.isError || explainQuery.isError ? (
            <InspectorState
              title="Failed to load raw observation."
              body={
                (rawQuery.error as Error | undefined)?.message ??
                (explainQuery.error as Error | undefined)?.message ??
                "unknown error"
              }
              tone="error"
            />
          ) : rawQuery.data && explainQuery.data ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="grid gap-6">
                <section className="panel overflow-hidden">
                  <div className="panel-hd">
                    <span className="eyebrow">Raw observation</span>
                    <span className="caption mono">
                      {rawQuery.data.source}
                    </span>
                  </div>
                  <div className="panel-body">
                    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-[12px]">
                      <Field label="collected_at" value={rawQuery.data.collected_at} />
                      <Field
                        label="gpu_model_reported"
                        value={rawQuery.data.gpu_model_reported}
                      />
                      <Field
                        label="region_reported"
                        value={rawQuery.data.region_reported ?? <span className="pill-unknown">UNKNOWN</span>}
                      />
                      <Field
                        label="commitment_type_reported"
                        value={
                          rawQuery.data.commitment_type_reported ?? (
                            <span className="pill-unknown">UNKNOWN</span>
                          )
                        }
                      />
                      <Field
                        label="price_hourly"
                        value={`$${rawQuery.data.price_hourly.toFixed(4)}`}
                      />
                    </dl>
                  </div>
                </section>

                <JsonPanel
                  title="raw_payload"
                  value={rawQuery.data.raw_payload}
                />

                {rawQuery.data.provider_metadata && (
                  <JsonPanel
                    title="provider_metadata"
                    value={rawQuery.data.provider_metadata}
                  />
                )}
              </div>

              <div className="grid gap-6">
                <ExplainPanel
                  title="GPU canonicalization"
                  body={<GpuSection exp={explainQuery.data.gpu} />}
                />
                <ExplainPanel
                  title="Commitment canonicalization"
                  body={<CommitmentSection exp={explainQuery.data.commitment} />}
                />
                <ExplainPanel
                  title="Region normalization"
                  body={<RegionSection exp={explainQuery.data.region} />}
                />
                <ExplainPanel
                  title="Bundle extraction"
                  body={<BundleSection exp={explainQuery.data.bundle} />}
                />
              </div>
            </div>
          ) : (
            <InspectorState
              title="Raw observation unavailable."
              body="The audit trail did not return any data for this raw observation."
            />
          )}
        </div>
      </div>
    </>
  );
}

function JsonPanel({
  title,
  value,
}: {
  title: string;
  value: Record<string, unknown>;
}) {
  return (
    <section className="panel overflow-hidden">
      <div className="panel-hd">
        <span className="eyebrow">{title}</span>
      </div>
      <pre className="mono m-0 overflow-x-auto px-4 py-4 text-[11px] leading-[1.55] text-[var(--ink-mid)]">
        {JSON.stringify(value, null, 2)}
      </pre>
    </section>
  );
}

function ExplainPanel({
  title,
  body,
}: {
  title: string;
  body: React.ReactNode;
}) {
  return (
    <section className="panel overflow-hidden">
      <div className="panel-hd">
        <span className="eyebrow">{title}</span>
      </div>
      <div className="panel-body">{body}</div>
    </section>
  );
}

function GpuSection({ exp }: { exp: GpuCanonicalizationExplanation }) {
  return (
    <div className="grid gap-3">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-[12px]">
        <Field label="reported_name" value={exp.reported_name} />
        <Field
          label="canonical_sku"
          value={
            exp.canonical_sku ?? <span className="pill-unknown">UNKNOWN</span>
          }
        />
        <Field
          label="gpu_variant"
          value={exp.gpu_variant ?? <span className="pill-unknown">UNKNOWN</span>}
        />
        <Field label="vram_gb" value={exp.vram_gb?.toString() ?? "—"} />
      </dl>
      <Trail steps={exp.rules} />
    </div>
  );
}

function CommitmentSection({
  exp,
}: {
  exp: CommitmentCanonicalizationExplanation;
}) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-[12px]">
      <Field label="reported_type" value={exp.reported_type ?? "—"} />
      <Field label="canonical_type" value={exp.canonical_type} />
      <Field label="rule" value={exp.rule} />
      <Field label="matched_key" value={exp.matched_key ?? "—"} />
    </dl>
  );
}

function RegionSection({ exp }: { exp: RegionNormalizationExplanation }) {
  return (
    <div className="grid gap-3">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-[12px]">
        <Field label="branch" value={exp.branch} />
        <Field label="region_reported" value={exp.region_reported ?? "—"} />
        <Field
          label="country"
          value={exp.country ?? <span className="pill-unknown">UNKNOWN</span>}
        />
        <Field label="state" value={exp.state ?? "—"} />
        <Field label="city" value={exp.city ?? "—"} />
      </dl>
      <Trail steps={exp.trail} />
    </div>
  );
}

function BundleSection({ exp }: { exp: BundleExtractionExplanation }) {
  return (
    <div className="grid gap-3">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-[12px]">
        <Field label="branch" value={exp.branch} />
        <Field label="vcpus" value={exp.vcpus?.toString() ?? "—"} />
        <Field label="ram_gb" value={exp.ram_gb?.toString() ?? "—"} />
        <Field label="storage_gb" value={exp.storage_gb?.toString() ?? "—"} />
        <Field
          label="verification_tier"
          value={exp.verification_tier ?? "—"}
        />
      </dl>

      {exp.fields.length > 0 && (
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
            {exp.fields.map((field) => (
              <tr key={field.canonical_field}>
                <td className="mono text-[11px] text-[var(--ink)]">
                  {field.canonical_field}
                </td>
                <td className="mono text-[11px] text-[var(--ink-mid)]">
                  {field.source_field ?? "—"}
                </td>
                <td className="caption">{field.transformation ?? "—"}</td>
                <td className="mono text-[11px] text-[var(--ink)]">
                  {formatResult(field.result)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Trail({ steps }: { steps: string[] }) {
  if (steps.length === 0) {
    return <p className="caption m-0">No explicit rules recorded.</p>;
  }

  return (
    <ul className="caption m-0 list-disc space-y-1.5 pl-5">
      {steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ul>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <>
      <dt className="caption">{label}</dt>
      <dd className="mono m-0 text-[var(--ink)]">{value}</dd>
    </>
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

function formatResult(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return JSON.stringify(value);
}
