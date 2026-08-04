"use client";

import { useQuery } from "@tanstack/react-query";
import { getDispersion } from "@/lib/api";
import type { DispersionPoint } from "@/lib/types";
import { DispersionBand, type DispersionBandPoint } from "./DispersionBand";

function ChartPlaceholder({
  message,
  tone = "muted",
}: {
  message: string;
  tone?: "muted" | "error";
}) {
  return (
    <div
      className={`obs-sheet obs-sheet--empty${tone === "error" ? " is-error" : ""}`}
    >
      <span className="obs-sheet__rule" aria-hidden />
      <div className="obs-sheet__empty-msg">{message}</div>
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

  const title = `Daily price dispersion for ${gpuSku}: shaded band from 25th to 75th percentile, line is median, in USD per GPU-hour. Move the pointer or use the arrow keys to read a single day.`;

  return <DispersionBand data={bandData} height={312} title={title} />;
}
