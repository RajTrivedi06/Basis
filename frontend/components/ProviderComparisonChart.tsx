"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart } from "@tremor/react";
import { getProviders } from "@/lib/api";
import type { ProviderSummary } from "@/lib/types";

/**
 * Per-provider median deviation vs. market median on the latest observation
 * date, plus a coverage table. Shows which providers run above or below the
 * market average and gives a sense of each provider's dataset size.
 */
export function ProviderComparisonChart() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["providers"],
    queryFn: getProviders,
  });

  if (isLoading) {
    return <Placeholder message="Loading providers…" />;
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
    return <Placeholder message="No provider data available." tone="muted" />;
  }

  // Chart data: provider -> deviation_pct (keep sign).
  const chartData = data.items
    .filter((p) => p.median_deviation_pct !== null)
    .map((p) => ({
      provider: p.provider,
      "Median deviation (%)": round2(p.median_deviation_pct as number),
    }))
    .sort((a, b) => a["Median deviation (%)"] - b["Median deviation (%)"]);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-medium text-gray-100">
          Median price deviation vs. market (latest date)
        </h2>
        <span className="text-xs text-gray-500">
          positive = above market · negative = below market
        </span>
      </div>

      <BarChart
        className="mt-4 h-72"
        data={chartData}
        index="provider"
        categories={["Median deviation (%)"]}
        colors={["indigo"]}
        valueFormatter={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`}
        yAxisWidth={60}
        showLegend={false}
      />

      <div className="mt-8">
        <h3 className="text-sm font-medium text-gray-200">Provider coverage</h3>
        <CoverageTable items={data.items} />
      </div>
    </div>
  );
}

function CoverageTable({ items }: { items: ProviderSummary[] }) {
  const sorted = [...items].sort((a, b) => b.offer_count - a.offer_count);
  return (
    <div className="mt-3 overflow-hidden rounded-md border border-gray-800">
      <table className="w-full text-sm">
        <thead className="bg-gray-900 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-3 py-2 text-left">Provider</th>
            <th className="px-3 py-2 text-right">Offers</th>
            <th className="px-3 py-2 text-right">Distinct SKUs</th>
            <th className="px-3 py-2 text-right">Deviation</th>
            <th className="px-3 py-2 text-right">Latest collection</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.provider} className="border-t border-gray-800">
              <td className="px-3 py-2 text-gray-200">{p.provider}</td>
              <td className="px-3 py-2 text-right font-mono text-xs text-gray-300">
                {p.offer_count.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-gray-300">
                {p.distinct_skus}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-gray-300">
                {p.median_deviation_pct === null
                  ? "—"
                  : `${p.median_deviation_pct > 0 ? "+" : ""}${p.median_deviation_pct.toFixed(1)}%`}
              </td>
              <td className="px-3 py-2 text-right text-xs text-gray-400">
                {p.latest_collection
                  ? new Date(p.latest_collection).toLocaleString()
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
    <div className={`flex h-72 items-center justify-center rounded-md border border-gray-800 bg-gray-900/40 text-sm ${color}`}>
      {message}
    </div>
  );
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
