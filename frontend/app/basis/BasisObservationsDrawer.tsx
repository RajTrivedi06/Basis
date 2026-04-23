"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDecompositionObservations } from "@/lib/api";
import type { DecompositionObservation } from "@/lib/types";

export function BasisObservationsDrawer({
  gpuSku,
  date,
  open,
  suspendEscape = false,
  onClose,
  onInspect,
}: {
  gpuSku: string;
  date: string | null;
  open: boolean;
  suspendEscape?: boolean;
  onClose: () => void;
  onInspect: (rawObservationId: number) => void;
}) {
  const observationsQuery = useQuery({
    queryKey: ["basis-drawer-observations", gpuSku, date],
    queryFn: () =>
      getDecompositionObservations(gpuSku, date ? { date } : undefined),
    enabled: open && !!date,
  });

  useEffect(() => {
    if (!open || suspendEscape) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, suspendEscape]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60"
        aria-hidden="true"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-label={`Observations contributing to ${gpuSku}`}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[1100px] flex-col border-l border-[var(--line-hi)] bg-[var(--bg)] shadow-2xl"
      >
        <header className="border-b border-[var(--line-lo)] px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="eyebrow mb-1">Canonical offers</div>
              <h2 className="serif m-0 text-[22px] font-normal text-[var(--ink-hi)]">
                Provenance drilldown
              </h2>
              <p className="caption mt-2 max-w-[560px]">
                Every row below contributed to the latest basis decomposition for{" "}
                <span className="mono text-[var(--ink)]">{gpuSku}</span>
                {date ? ` on ${date}` : ""}. UNKNOWN cells stay visible; missingness is part of the audit trail.
              </p>
            </div>
            <button type="button" className="btn ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {!date ? (
            <DrawerState
              title="No decomposition date available."
              body="The latest basis decomposition has not loaded yet, so there is no contributing-offer slice to inspect."
            />
          ) : observationsQuery.isLoading ? (
            <DrawerState
              title="Loading contributing observations…"
              body="Fetching the canonical offers that fed the current daily decomposition."
            />
          ) : observationsQuery.isError ? (
            <DrawerState
              title="Failed to load contributing observations."
              body={(observationsQuery.error as Error)?.message ?? "unknown error"}
              tone="error"
            />
          ) : !observationsQuery.data || observationsQuery.data.items.length === 0 ? (
            <DrawerState
              title="No contributing offers found."
              body="This SKU has a decomposition row, but the contributing-offer endpoint returned no canonical offers for the selected date."
            />
          ) : (
            <div className="panel overflow-hidden">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th className="text-right">$/hr</th>
                    <th>Commitment</th>
                    <th>Region</th>
                    <th>Bundle</th>
                    <th className="text-right">Raw</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {observationsQuery.data.items.map((observation) => (
                    <ObservationRow
                      key={observation.canonical_offer_id}
                      observation={observation}
                      onInspect={onInspect}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function ObservationRow({
  observation,
  onInspect,
}: {
  observation: DecompositionObservation;
  onInspect: (rawObservationId: number) => void;
}) {
  return (
    <tr>
      <td className="text-[var(--ink)]">{observation.provider}</td>
      <td className="num text-right text-[var(--ink)]">
        {observation.price_usd_per_hour.toFixed(3)}
      </td>
      <td className="mono text-[11px]">
        {observation.commitment_type}
      </td>
      <td>
        <RegionValue observation={observation} />
      </td>
      <td className="caption">
        <BundleValue observation={observation} />
      </td>
      <td className="num text-right text-[var(--ink-mid)]">
        {observation.raw_observation_id}
      </td>
      <td className="text-right">
        <button
          type="button"
          className="btn ghost"
          onClick={() => onInspect(observation.raw_observation_id)}
        >
          Inspect
        </button>
      </td>
    </tr>
  );
}

function RegionValue({
  observation,
}: {
  observation: DecompositionObservation;
}) {
  const parts: string[] = [];
  if (observation.region_country) parts.push(observation.region_country);
  if (observation.region_state) parts.push(observation.region_state);
  if (observation.region_city) parts.push(observation.region_city);

  if (parts.length === 0) {
    return <span className="pill-unknown">UNKNOWN</span>;
  }

  return (
    <span className="mono text-[11px] text-[var(--ink)]">
      {parts.join(" · ")}
    </span>
  );
}

function BundleValue({
  observation,
}: {
  observation: DecompositionObservation;
}) {
  const items: string[] = [];
  if (observation.vcpus_bundled != null) {
    items.push(`${observation.vcpus_bundled} vCPU`);
  }
  if (observation.ram_gb_bundled != null) {
    items.push(`${observation.ram_gb_bundled}GB RAM`);
  }
  if (observation.storage_gb_bundled != null) {
    items.push(`${Math.round(observation.storage_gb_bundled)}GB disk`);
  }
  if (observation.verification_tier) {
    items.push(observation.verification_tier);
  }

  if (items.length === 0) {
    return <span className="pill-unknown">UNKNOWN</span>;
  }

  return <span>{items.join(" · ")}</span>;
}

function DrawerState({
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
