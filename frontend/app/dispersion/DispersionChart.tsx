"use client";

import { useQuery } from "@tanstack/react-query";
import { getDispersion } from "@/lib/api";
import type { DispersionPoint } from "@/lib/types";
import { DispersionBand, type DispersionBandPoint } from "./DispersionBand";

function ChartPlaceholder({
  message,
  tone = "muted",
  className = "",
}: {
  message: string;
  tone?: "muted" | "error";
  className?: string;
}) {
  const border =
    tone === "error" ? "border-[var(--verdict-bad)]" : "border-[var(--line)]";
  const text =
    tone === "error" ? "text-[var(--verdict-bad)]" : "text-[var(--ink-dim)]";
  return (
    <div
      className={`flex min-h-[380px] items-center justify-center rounded-[var(--r-md)] border bg-[var(--panel-lo)] px-4 text-sm ${border} ${text} ${className}`}
    >
      {message}
    </div>
  );
}

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
      <ChartPlaceholder
        message={`No dispersion data for ${gpuSku} yet.`}
        tone="muted"
      />
    );
  }

  const bandData: DispersionBandPoint[] = data.points.map(
    (p: DispersionPoint) => ({
      date: p.date,
      p25: p.p25_price,
      median: p.median_price,
      p75: p.p75_price,
    })
  );

  // The day/offer count lives on the page's control row (see
  // DispersionPageClient) so the panel is chart and nothing else.
  const title = `Daily price dispersion for ${gpuSku}: shaded band from 25th to 75th percentile, line is median, in USD per GPU-hour. Move the pointer or use the arrow keys to read a single day.`;

  return <DispersionBand data={bandData} height={380} title={title} />;
}
