"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDecompositionObservations } from "@/lib/api";
import type { DecompositionObservation } from "@/lib/types";

/**
 * Right-side drawer listing canonical offers that contributed to a given
 * (gpu_sku, date) decomposition bucket. Used for provenance drilldown from
 * the Basis decomposition page.
 *
 * UNKNOWN factor values are rendered explicitly — part of the drilldown's
 * purpose is to surface holes in normalization, not hide them.
 */
export function ObservationsDrawer({
  gpuSku,
  date,
  open,
  onClose,
  onInspect,
}: {
  gpuSku: string;
  date: string | null;
  open: boolean;
  onClose: () => void;
  onInspect: (rawObservationId: number) => void;
}) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["decomposition-observations", gpuSku, date],
    queryFn: () =>
      getDecompositionObservations(gpuSku, date ? { date } : undefined),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-label={`Observations contributing to ${gpuSku} decomposition`}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-3xl flex-col border-l border-gray-800 bg-gray-950 shadow-2xl"
      >
        <header className="flex items-baseline justify-between border-b border-gray-800 px-6 py-4">
          <div>
            <h2 className="text-sm font-medium text-gray-100">
              Observations feeding this decomposition
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              <span className="font-mono text-gray-400">{gpuSku}</span>
              {data ? ` · ${data.date} · ${data.items.length} offers` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-gray-800 px-3 py-1 text-xs text-gray-400 hover:border-gray-700 hover:text-gray-200"
          >
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="p-8 text-sm text-gray-500">Loading observations…</div>
          )}
          {isError && (
            <div className="p-8 text-sm text-red-300">
              Failed to load: {(error as Error)?.message ?? "unknown error"}
            </div>
          )}
          {data && data.items.length === 0 && (
            <div className="p-8 text-sm text-gray-500">
              No canonical offers recorded for {gpuSku} on {data.date}.
            </div>
          )}
          {data && data.items.length > 0 && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-900/90 text-xs uppercase tracking-wide text-gray-500 backdrop-blur">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Provider</th>
                  <th className="px-4 py-2 text-right font-medium">$/hr</th>
                  <th className="px-4 py-2 text-left font-medium">Commitment</th>
                  <th className="px-4 py-2 text-left font-medium">Region</th>
                  <th className="px-4 py-2 text-left font-medium">Bundle</th>
                  <th className="px-4 py-2 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((o) => (
                  <ObservationRow key={o.canonical_offer_id} obs={o} onInspect={onInspect} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </aside>
    </>
  );
}

function ObservationRow({
  obs,
  onInspect,
}: {
  obs: DecompositionObservation;
  onInspect: (id: number) => void;
}) {
  return (
    <tr className="border-t border-gray-800 align-top hover:bg-gray-900/40">
      <td className="px-4 py-2 text-gray-300">{obs.provider}</td>
      <td className="px-4 py-2 text-right font-mono text-gray-300">
        {obs.price_usd_per_hour.toFixed(3)}
      </td>
      <td className="px-4 py-2 text-gray-300">{obs.commitment_type}</td>
      <td className="px-4 py-2 text-gray-300">
        <RegionCell obs={obs} />
      </td>
      <td className="px-4 py-2 text-gray-400">
        <BundleCell obs={obs} />
      </td>
      <td className="px-4 py-2 text-right">
        <button
          type="button"
          onClick={() => onInspect(obs.raw_observation_id)}
          className="rounded-sm border border-gray-800 px-2 py-1 text-xs text-gray-300 hover:border-gray-700 hover:bg-gray-900"
        >
          Inspect
        </button>
      </td>
    </tr>
  );
}

function RegionCell({ obs }: { obs: DecompositionObservation }) {
  const parts: (string | JSX.Element)[] = [];
  const country = obs.region_country ?? <Unknown key="c" />;
  parts.push(country);
  if (obs.region_state) parts.push(`, ${obs.region_state}`);
  if (obs.region_city) parts.push(`, ${obs.region_city}`);
  return <span>{parts}</span>;
}

function BundleCell({ obs }: { obs: DecompositionObservation }) {
  const items: string[] = [];
  if (obs.vcpus_bundled != null) items.push(`${obs.vcpus_bundled} vCPU`);
  if (obs.ram_gb_bundled != null) items.push(`${obs.ram_gb_bundled}GB RAM`);
  if (obs.storage_gb_bundled != null)
    items.push(`${Math.round(obs.storage_gb_bundled)}GB disk`);
  if (obs.verification_tier) items.push(obs.verification_tier);
  if (items.length === 0) return <Unknown />;
  return <span className="text-xs">{items.join(" · ")}</span>;
}

function Unknown() {
  return (
    <span className="rounded-sm bg-rose-950/50 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-rose-300">
      unknown
    </span>
  );
}
