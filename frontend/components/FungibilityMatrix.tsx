"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getFungibilityMatrix } from "@/lib/api";
import type { FungibilityMatrixRow } from "@/lib/types";

type SortKey = "gpu_sku" | "median_price" | "pct_residual" | "observation_count" | "provider_count";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "gpu_sku", label: "GPU SKU", align: "left" },
  { key: "median_price", label: "Median $/hr", align: "right" },
  { key: "pct_residual", label: "% Residual", align: "right" },
  { key: "observation_count", label: "Offers", align: "right" },
  { key: "provider_count", label: "Providers", align: "right" },
];

export function FungibilityMatrix() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["fungibility-matrix"],
    queryFn: () => getFungibilityMatrix(),
  });

  const [sortKey, setSortKey] = useState<SortKey>("pct_residual");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(
    () => (data ? sortRows(data.items, sortKey, sortDir) : []),
    [data, sortKey, sortDir]
  );

  if (isLoading) {
    return <Placeholder message="Loading fungibility matrix…" />;
  }
  if (isError) {
    return (
      <Placeholder
        message={`Failed to load: ${(error as Error)?.message ?? "unknown error"}`}
        tone="error"
      />
    );
  }
  if (!data || data.items.length === 0) {
    return <Placeholder message="No canonical SKUs observed yet." tone="muted" />;
  }

  const toggle = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "gpu_sku" ? "asc" : "desc");
    }
  };

  return (
    <div className="overflow-hidden rounded-md border border-gray-800">
      <div className="flex items-baseline justify-between border-b border-gray-800 bg-gray-900/60 px-4 py-3">
        <div>
          <h2 className="text-sm font-medium text-gray-100">Fungibility matrix</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Latest observed date per canonical SKU. Sort by % residual to rank by basis risk.
          </p>
        </div>
        <span className="text-xs text-gray-500">{data.items.length} SKUs</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-900/40 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`px-3 py-2 font-medium ${c.align === "right" ? "text-right" : "text-left"}`}
                >
                  <button
                    type="button"
                    onClick={() => toggle(c.key)}
                    className="inline-flex items-center gap-1 hover:text-gray-300"
                  >
                    {c.label}
                    <SortIndicator active={sortKey === c.key} dir={sortDir} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <MatrixRow key={row.gpu_sku} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MatrixRow({ row }: { row: FungibilityMatrixRow }) {
  const residualCell =
    row.pct_residual === null ? (
      <span className="inline-flex items-center rounded-sm bg-gray-800 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
        accumulating
      </span>
    ) : (
      <span className="font-mono font-semibold text-rose-300">
        {row.pct_residual.toFixed(1)}%
      </span>
    );

  return (
    <tr className="border-t border-gray-800 hover:bg-gray-900/40">
      <td className="px-3 py-2">
        <div className="font-mono text-gray-200">{row.gpu_sku}</div>
        <div className="text-[11px] text-gray-500">{row.latest_date}</div>
      </td>
      <td className="px-3 py-2 text-right font-mono text-gray-300">
        ${row.median_price.toFixed(2)}
      </td>
      <td className="px-3 py-2 text-right">{residualCell}</td>
      <td className="px-3 py-2 text-right font-mono text-gray-400">
        {row.observation_count}
      </td>
      <td className="px-3 py-2 text-right font-mono text-gray-400">
        {row.provider_count}
      </td>
    </tr>
  );
}

function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="text-gray-700">↕</span>;
  return <span className="text-gray-300">{dir === "asc" ? "↑" : "↓"}</span>;
}

function Placeholder({
  message,
  tone = "muted",
}: {
  message: string;
  tone?: "muted" | "error";
}) {
  const color = tone === "error" ? "text-red-300" : "text-gray-500";
  return (
    <div
      className={`flex h-48 items-center justify-center rounded-md border border-gray-800 bg-gray-900/40 text-sm ${color}`}
    >
      {message}
    </div>
  );
}

function sortRows(
  rows: FungibilityMatrixRow[],
  key: SortKey,
  dir: SortDir
): FungibilityMatrixRow[] {
  const mult = dir === "asc" ? 1 : -1;
  const copy = [...rows];
  copy.sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    // Nulls always last, regardless of direction.
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    if (av < bv) return -1 * mult;
    if (av > bv) return 1 * mult;
    return 0;
  });
  return copy;
}
