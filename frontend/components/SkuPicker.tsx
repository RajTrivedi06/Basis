"use client";

import { useQuery } from "@tanstack/react-query";
import { getGpuSkus } from "@/lib/api";
import type { GpuSkuSummary } from "@/lib/types";

/**
 * SKU picker dropdown fed by /api/gpu-skus.
 *
 * Sorts by offer_count desc so the most-observed SKUs surface first,
 * which is usually what the user wants (H100, A100, RTX 4090).
 */
export function SkuPicker({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (sku: string) => void;
  className?: string;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["gpu-skus"],
    queryFn: getGpuSkus,
  });

  if (isLoading) {
    return (
      <select
        disabled
        className={`rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink-mid)] ${className}`}
      >
        <option>Loading SKUs…</option>
      </select>
    );
  }

  if (isError || !data) {
    return (
      <select
        disabled
        className={`rounded-md border border-[var(--verdict-bad)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--verdict-bad)] ${className}`}
      >
        <option>Error loading SKUs</option>
      </select>
    );
  }

  const sorted = [...data.items].sort(
    (a: GpuSkuSummary, b: GpuSkuSummary) => b.offer_count - a.offer_count
  );

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] hover:border-[var(--line-hi)] focus:border-[var(--ink-dim)] focus:outline-none ${className}`}
    >
      {sorted.map((sku) => (
        <option key={sku.gpu_sku} value={sku.gpu_sku}>
          {sku.gpu_sku} · {sku.offer_count} offers · {sku.provider_count} providers
        </option>
      ))}
    </select>
  );
}
