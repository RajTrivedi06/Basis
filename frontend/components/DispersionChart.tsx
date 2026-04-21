"use client";

import { useQuery } from "@tanstack/react-query";
import { LineChart } from "@tremor/react";
import { getDispersion } from "@/lib/api";
import type { DispersionPoint } from "@/lib/types";

/**
 * Daily dispersion time series: median, p25, p75 per date for a given SKU.
 *
 * Uses the all-providers rollup from /api/dispersion/{gpu_sku}. If there are
 * zero points (a SKU without enough observations on any day), we show an
 * empty-state card instead of a blank chart.
 */
export function DispersionChart({ gpuSku }: { gpuSku: string }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["dispersion", gpuSku],
    queryFn: () => getDispersion(gpuSku),
  });

  if (isLoading) {
    return <ChartPlaceholder message="Loading dispersion…" />;
  }

  if (isError) {
    return (
      <ChartPlaceholder
        message={`Failed to load: ${(error as Error)?.message ?? "unknown error"}`}
        tone="error"
      />
    );
  }

  if (!data || data.points.length === 0) {
    return (
      <ChartPlaceholder message={`No dispersion data for ${gpuSku} yet.`} tone="muted" />
    );
  }

  const chartData = data.points.map((p: DispersionPoint) => ({
    date: p.date,
    "25th percentile": round3(p.p25_price),
    Median: round3(p.median_price),
    "75th percentile": round3(p.p75_price),
  }));

  const totalObs = data.points.reduce(
    (sum: number, p: DispersionPoint) => sum + p.observation_count,
    0
  );

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-medium text-gray-100">
          Price spread · <span className="font-mono text-sm text-gray-400">{gpuSku}</span>
        </h2>
        <span className="text-xs text-gray-500">
          {data.points.length} {data.points.length === 1 ? "day" : "days"} · {totalObs} offers
        </span>
      </div>

      <LineChart
        className="mt-4 h-72"
        data={chartData}
        index="date"
        categories={["25th percentile", "Median", "75th percentile"]}
        colors={["sky", "indigo", "amber"]}
        yAxisWidth={60}
        valueFormatter={dollarFmt}
        showLegend={true}
        showAnimation={true}
      />
    </div>
  );
}

function ChartPlaceholder({
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

function dollarFmt(value: number): string {
  return `$${value.toFixed(2)}/hr`;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
