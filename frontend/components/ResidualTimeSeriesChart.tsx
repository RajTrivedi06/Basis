"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBasisTimeseries } from "@/lib/api";
import type { BasisDecompositionResponse } from "@/lib/types";

/**
 * Residual share over time, rendered as a hand-built SVG line chart.
 * No chart library — stays consistent with ADR 0005 (Tremor removal).
 *
 * Treats points as evenly spaced on the x-axis (one collection per day).
 * Real-world gaps show as straight-line interpolation; that's acceptable
 * since the chart's job is variance-share trend, not literal-time fidelity.
 */

const DEFAULT_GPU_SKU = "h100_sxm_80gb";
const VIEW_W = 600;
const VIEW_H = 220;
const PAD_L = 38;
const PAD_R = 14;
const PAD_T = 14;
const PAD_B = 30;
const PLOT_W = VIEW_W - PAD_L - PAD_R;
const PLOT_H = VIEW_H - PAD_T - PAD_B;

export type ResidualTimeSeriesChartProps = {
  gpuSku?: string;
  since?: string;
  until?: string;
};

export function ResidualTimeSeriesChart({
  gpuSku = DEFAULT_GPU_SKU,
  since,
  until,
}: ResidualTimeSeriesChartProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["basis-timeseries", gpuSku, since ?? null, until ?? null],
    queryFn: () => getBasisTimeseries(gpuSku, { since, until }),
  });

  if (isLoading) return <ChartFrame state="loading" />;
  if (isError) return <ChartFrame state="error" />;
  if (!data || data.points.length === 0) return <ChartFrame state="empty" />;

  return <ChartFrame state="ok" points={data.points} gpuSku={gpuSku} />;
}

type ChartFrameProps =
  | { state: "loading" | "error" | "empty" }
  | { state: "ok"; points: BasisDecompositionResponse[]; gpuSku: string };

function ChartFrame(props: ChartFrameProps) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: 240,
      }}
    >
      {props.state === "ok" ? (
        <Chart points={props.points} gpuSku={props.gpuSku} />
      ) : (
        <Placeholder state={props.state} />
      )}
    </div>
  );
}

function Placeholder({ state }: { state: "loading" | "error" | "empty" }) {
  const message =
    state === "loading"
      ? "Loading residual time series…"
      : state === "error"
      ? "Failed to load residual time series"
      : "No data in the selected range";

  return (
    <div
      className="caption"
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: state === "error" ? "var(--verdict-bad)" : "var(--ink-dim)",
        background: "var(--panel-hi)",
        border: "1px solid var(--line-lo)",
        borderRadius: 2,
        textAlign: "center",
        padding: "0 16px",
      }}
    >
      {message}
    </div>
  );
}

function Chart({
  points,
  gpuSku,
}: {
  points: BasisDecompositionResponse[];
  gpuSku: string;
}) {
  const { values, med, upperFence, ticks, outlierIdxs } = useMemo(() => {
    const vals = points.map((p) => p.pct_residual);
    const m = median(vals);
    const q1 = quantile(vals, 0.25);
    const q3 = quantile(vals, 0.75);
    const iqr = q3 - q1;
    const fence = m + 1.5 * iqr;
    const t = chooseTickIndices(points.length);
    const o = vals
      .map((v, i) => (v > fence ? i : -1))
      .filter((i) => i >= 0);
    return {
      values: vals,
      med: m,
      upperFence: fence,
      ticks: t,
      outlierIdxs: o,
    };
  }, [points]);

  const n = points.length;

  const xAt = (i: number) => {
    if (n <= 1) return PAD_L + PLOT_W / 2;
    return PAD_L + (i / (n - 1)) * PLOT_W;
  };
  const yAt = (v: number) => PAD_T + (1 - clamp01(v / 100)) * PLOT_H;

  const linePoints = values
    .map((v, i) => `${xAt(i).toFixed(2)},${yAt(v).toFixed(2)}`)
    .join(" ");

  const yGrid = [0, 25, 50, 75, 100];
  const medY = yAt(med);

  const ariaLabel = `Residual share for ${gpuSku} from ${
    points[0].date
  } to ${points[n - 1].date}. Median ${med.toFixed(0)} percent. ${
    outlierIdxs.length
  } single-day outlier${outlierIdxs.length === 1 ? "" : "s"}.`;

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      {/* Y gridlines + labels */}
      {yGrid.map((g) => {
        const y = yAt(g);
        return (
          <g key={`y-${g}`}>
            <line
              x1={PAD_L}
              x2={VIEW_W - PAD_R}
              y1={y}
              y2={y}
              stroke="var(--line-lo)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={PAD_L - 6}
              y={y}
              dy="0.32em"
              textAnchor="end"
              fontSize={10}
              fontFamily="var(--f-mono)"
              fill="var(--ink-dim)"
            >
              {g}%
            </text>
          </g>
        );
      })}

      {/* X-axis tick labels */}
      {ticks.map((i) => {
        const x = xAt(i);
        return (
          <text
            key={`x-${i}`}
            x={x}
            y={VIEW_H - PAD_B + 16}
            textAnchor="middle"
            fontSize={10}
            fontFamily="var(--f-mono)"
            fill="var(--ink-dim)"
          >
            {fmtTickDate(points[i].date)}
          </text>
        );
      })}

      {/* Median reference line */}
      <line
        x1={PAD_L}
        x2={VIEW_W - PAD_R}
        y1={medY}
        y2={medY}
        stroke="var(--residual-line)"
        strokeWidth={1}
        strokeDasharray="3 3"
        vectorEffect="non-scaling-stroke"
      />
      <text
        x={VIEW_W - PAD_R - 4}
        y={medY - 4}
        textAnchor="end"
        fontSize={10}
        fontFamily="var(--f-mono)"
        fill="var(--residual)"
      >
        median {med.toFixed(0)}%
      </text>

      {/* Line */}
      {n > 1 && (
        <polyline
          points={linePoints}
          fill="none"
          stroke="var(--residual)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* Points */}
      {values.map((v, i) => {
        const isOutlier = outlierIdxs.includes(i);
        return (
          <circle
            key={`p-${i}`}
            cx={xAt(i)}
            cy={yAt(v)}
            r={isOutlier ? 4 : 2.5}
            fill="var(--residual)"
            stroke={isOutlier ? "var(--bg)" : "none"}
            strokeWidth={isOutlier ? 1.5 : 0}
          />
        );
      })}

      {/* Outlier labels */}
      {outlierIdxs.map((i) => {
        const x = xAt(i);
        const y = yAt(values[i]);
        // keep label on-canvas
        const anchor: "start" | "middle" | "end" =
          x < PAD_L + 40
            ? "start"
            : x > VIEW_W - PAD_R - 40
            ? "end"
            : "middle";
        return (
          <text
            key={`ol-${i}`}
            x={x}
            y={y - 8}
            textAnchor={anchor}
            fontSize={10}
            fontFamily="var(--f-mono)"
            fill="var(--residual)"
          >
            {fmtOutlierLabel(points[i].date, values[i])}
          </text>
        );
      })}
    </svg>
  );
}

// ---------- helpers ----------

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function quantile(arr: number[], q: number): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return base + 1 < s.length
    ? s[base] + rest * (s[base + 1] - s[base])
    : s[base];
}

function chooseTickIndices(n: number): number[] {
  if (n <= 1) return [0];
  // Aim for ~6 ticks; adapt downward for tiny ranges.
  const target = n <= 4 ? n : n <= 8 ? 4 : 6;
  const step = Math.max(1, Math.round((n - 1) / (target - 1)));
  const out: number[] = [];
  for (let i = 0; i < n; i += step) out.push(i);
  if (out[out.length - 1] !== n - 1) out.push(n - 1);
  return out;
}

function fmtTickDate(iso: string): string {
  // "2026-05-08" -> "5/8"
  const [, mm, dd] = iso.split("-");
  return `${Number(mm)}/${Number(dd)}`;
}

function fmtOutlierLabel(iso: string, v: number): string {
  return `${fmtTickDate(iso)} · ${v.toFixed(0)}%`;
}
