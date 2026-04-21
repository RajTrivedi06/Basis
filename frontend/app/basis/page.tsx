"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BasisDecompositionChart } from "@/components/BasisDecompositionChart";
import { ObservationsDrawer } from "@/components/ObservationsDrawer";
import { RawObservationInspector } from "@/components/RawObservationInspector";
import { SkuPicker } from "@/components/SkuPicker";
import { getBasisDecomposition } from "@/lib/api";

const DEFAULT_SKU = "h100_sxm_80gb";

export default function BasisPage() {
  const [sku, setSku] = useState<string>(DEFAULT_SKU);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inspectingId, setInspectingId] = useState<number | null>(null);

  // Read the date off the same query the chart uses so the drawer scopes to
  // the exact bucket the chart displays. Cached by React Query so this is free.
  const { data: decomposition } = useQuery({
    queryKey: ["basis", sku],
    queryFn: () => getBasisDecomposition(sku),
  });
  const date = decomposition?.date ?? null;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">
          Basis Decomposition
        </h1>
        <p className="mt-2 max-w-3xl text-gray-400">
          For a given GPU, how much of the observed price variance is
          explained by region, commitment type, provider identity, and bundled
          resources — and how much remains as residual basis risk.
        </p>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-3">
          <span className="text-sm text-gray-400">GPU SKU</span>
          <SkuPicker value={sku} onChange={setSku} />
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-6">
          <BasisDecompositionChart gpuSku={sku} />
          <div className="mt-6 flex items-center justify-end">
            <button
              type="button"
              disabled={date == null}
              onClick={() => setDrawerOpen(true)}
              className="rounded-sm border border-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:border-gray-700 hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              View contributing observations →
            </button>
          </div>
        </div>
      </section>

      <section className="max-w-3xl text-sm text-gray-400">
        <h2 className="text-base font-medium text-gray-200">Method</h2>
        <p className="mt-2">
          Basis uses <span className="text-gray-200">sequential ANOVA on log-prices</span>{" "}
          in a fixed factor order:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-md border border-gray-800 bg-gray-950 px-4 py-3 font-mono text-xs text-gray-300">
          region → commitment → provider → bundle → residual
        </pre>
        <p className="mt-3">
          Log-prices are used because price ratios, not absolute differences,
          are the meaningful fungibility metric. Factor order matters: changing
          it redistributes attributions but leaves the residual unchanged. See
          the Methodology page for full detail.
        </p>
      </section>

      <ObservationsDrawer
        gpuSku={sku}
        date={date}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onInspect={(id) => setInspectingId(id)}
      />
      <RawObservationInspector
        rawObservationId={inspectingId}
        open={inspectingId != null}
        onClose={() => setInspectingId(null)}
      />
    </div>
  );
}
