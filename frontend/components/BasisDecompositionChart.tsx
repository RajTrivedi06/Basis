"use client";

import { useQuery } from "@tanstack/react-query";
import { getBasisDecomposition } from "@/lib/api";

/**
 * Variance decomposition visual, residual-first.
 *
 * The residual is the Basis finding — the large number at the top is the
 * protagonist. The four observable factors appear only as a thin, muted
 * stacked bar underneath, present for context but not competing for
 * attention.
 */
export function BasisDecompositionChart({ gpuSku }: { gpuSku: string }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["basis", gpuSku],
    queryFn: () => getBasisDecomposition(gpuSku),
  });

  if (isLoading) {
    return <Placeholder message="Loading decomposition…" />;
  }

  if (isError) {
    const msg = (error as Error)?.message ?? "unknown error";
    if (msg.startsWith("API 404")) {
      return (
        <Placeholder
          message={`Not enough data yet to decompose ${gpuSku}. Need ≥5 offers across ≥2 factor values on a single day.`}
          tone="muted"
        />
      );
    }
    return <Placeholder message={`Failed to load: ${msg}`} tone="error" />;
  }

  if (!data) {
    return <Placeholder message={`No decomposition for ${gpuSku}.`} tone="muted" />;
  }

  const factors: FactorSegment[] = [
    { name: "Region", value: data.variance_from_region, className: "bg-sky-800/70" },
    { name: "Commitment", value: data.variance_from_commitment, className: "bg-indigo-800/70" },
    { name: "Provider", value: data.variance_from_provider, className: "bg-violet-800/70" },
    { name: "Bundle", value: data.variance_from_bundle, className: "bg-amber-800/70" },
    { name: "Residual", value: data.residual_variance, className: "bg-rose-500" },
  ];

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-medium text-gray-100">
          Variance decomposition ·{" "}
          <span className="font-mono text-sm text-gray-400">{gpuSku}</span>
        </h2>
        <span className="text-xs text-gray-500">{data.date}</span>
      </div>

      <div className="mt-5 rounded-md border border-rose-900/60 bg-rose-950/20 px-6 py-6">
        <div className="text-xs uppercase tracking-wide text-rose-300">
          Residual (basis risk)
        </div>
        <div className="mt-1 font-mono text-5xl font-semibold text-rose-200 md:text-6xl">
          {data.pct_residual.toFixed(1)}%
        </div>
        <div className="mt-1 text-sm text-gray-400">
          of total log-price variance is unexplained by region, commitment,
          provider, or bundle
        </div>
      </div>

      <div className="mt-6">
        <StackedBar segments={factors} />
        <FactorLegend segments={factors} total={data.total_variance} />
      </div>

      <AttributionTable data={data} />
    </div>
  );
}

type FactorSegment = {
  name: string;
  value: number;
  className: string;
};

function StackedBar({ segments }: { segments: FactorSegment[] }) {
  const total = segments.reduce((s, seg) => s + Math.max(0, seg.value), 0);
  if (total <= 0) {
    return (
      <div className="h-3 w-full rounded-sm border border-dashed border-gray-800" />
    );
  }
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-sm border border-gray-800">
      {segments.map((seg) =>
        seg.value > 0 ? (
          <div
            key={seg.name}
            className={seg.className}
            style={{ width: `${(seg.value / total) * 100}%` }}
            title={`${seg.name}: ${((seg.value / total) * 100).toFixed(1)}%`}
          />
        ) : null
      )}
    </div>
  );
}

function FactorLegend({
  segments,
  total,
}: {
  segments: FactorSegment[];
  total: number;
}) {
  const denom = total > 0 ? total : 1;
  return (
    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
      {segments.map((seg) => (
        <div key={seg.name} className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-sm ${seg.className}`} />
          <span className={seg.name === "Residual" ? "text-rose-200" : "text-gray-400"}>
            {seg.name}
          </span>
          <span className="font-mono text-gray-500">
            {((seg.value / denom) * 100).toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function AttributionTable({
  data,
}: {
  data: {
    total_variance: number;
    variance_from_region: number;
    variance_from_commitment: number;
    variance_from_provider: number;
    variance_from_bundle: number;
    residual_variance: number;
  };
}) {
  const total = data.total_variance || 1;
  const rows: [string, number][] = [
    ["Region", data.variance_from_region],
    ["Commitment", data.variance_from_commitment],
    ["Provider", data.variance_from_provider],
    ["Bundle", data.variance_from_bundle],
    ["Residual", data.residual_variance],
  ];
  return (
    <div className="mt-6 rounded-md border border-gray-800">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([name, value]) => (
            <tr key={name} className="border-b border-gray-800 last:border-0">
              <td className="px-3 py-2 text-gray-300">{name}</td>
              <td className="px-3 py-2 text-right font-mono text-xs text-gray-400">
                {value.toFixed(4)}
              </td>
              <td className="px-3 py-2 text-right text-gray-400">
                {((value / total) * 100).toFixed(1)}%
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
    <div
      className={`flex h-72 items-center justify-center rounded-md border border-gray-800 bg-gray-900/40 px-6 text-center text-sm ${color}`}
    >
      {message}
    </div>
  );
}
