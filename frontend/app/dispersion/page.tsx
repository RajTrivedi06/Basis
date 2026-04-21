"use client";

import { useState } from "react";
import { DispersionChart } from "@/components/DispersionChart";
import { SkuPicker } from "@/components/SkuPicker";

const DEFAULT_SKU = "h100_sxm_80gb";

export default function DispersionPage() {
  const [sku, setSku] = useState<string>(DEFAULT_SKU);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">
          GPU Price Dispersion
        </h1>
        <p className="mt-2 max-w-3xl text-gray-400">
          Daily price distribution across cloud providers for a given GPU.
          Basis collects public quoted prices twice daily from Vast.ai, RunPod,
          AWS EC2 Spot, and TensorDock, and tracks the 25th, 50th, and 75th
          percentiles of the per-GPU-hour price.
        </p>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-3">
          <span className="text-sm text-gray-400">GPU SKU</span>
          <SkuPicker value={sku} onChange={setSku} />
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-6">
          <DispersionChart gpuSku={sku} />
        </div>
      </section>

      <section className="max-w-3xl text-sm text-gray-400">
        <h2 className="text-base font-medium text-gray-200">How to read this chart</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <span className="text-gray-200">Median</span> is the middle price
            across all offers collected that day — a robust central tendency.
          </li>
          <li>
            <span className="text-gray-200">25th / 75th percentile</span> mark
            where the cheapest and most expensive quartiles begin.
          </li>
          <li>
            The gap between p75 and p25 is the interquartile range — a
            dispersion measure less sensitive to outliers than total range.
          </li>
          <li>
            Use the SKU picker to compare different GPU models. H100 SXM is the
            hero; RTX 4090 has much wider marketplace dispersion.
          </li>
        </ul>
      </section>
    </div>
  );
}
