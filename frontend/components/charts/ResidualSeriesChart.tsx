"use client";

import type { CSSProperties } from "react";
import {
  ERA_ANNOTATIONS,
  annotationIndex,
} from "@/components/charts/eraAnnotations";
import type { BasisDecompositionResponse } from "@/lib/types";

/**
 * Residual share over time as a bare polyline — the same hand-built SVG idiom
 * as ResidualTimeSeriesChart (ADR-0005: no chart library).
 *
 * Deliberately unsmoothed: the series is drawn point-to-point so a collapse or
 * a spike renders at its real angle. Both panels of the pooled exhibit share a
 * fixed 0–100% y-axis so the two shapes can be compared by eye.
 */

const VIEW_W = 460;
const VIEW_H = 210;
const PAD_L = 34;
const PAD_R = 12;
const PAD_T = 18;
const PAD_B = 28;
const PLOT_W = VIEW_W - PAD_L - PAD_R;
const PLOT_H = VIEW_H - PAD_T - PAD_B;

export interface ResidualSeriesChartProps {
  points: BasisDecompositionResponse[];
  /** Stroke for the series; the residual color is reserved for market-priced. */
  color: string;
  /** Screen-reader description of what this panel shows. */
  ariaLabel: string;
}

export function ResidualSeriesChart({
  points,
  color,
  ariaLabel,
}: ResidualSeriesChartProps) {
  const n = points.length;
  const dates = points.map((p) => p.date);
  const values = points.map((p) => p.pct_residual);

  const xAt = (i: number) =>
    n <= 1 ? PAD_L + PLOT_W / 2 : PAD_L + (i / (n - 1)) * PLOT_W;
  const yAt = (v: number) => PAD_T + (1 - clamp01(v / 100)) * PLOT_H;

  const linePoints = values
    .map((v, i) => `${xAt(i).toFixed(2)},${yAt(v).toFixed(2)}`)
    .join(" ");

  const markers = ERA_ANNOTATIONS.map((annotation) => ({
    annotation,
    index: annotationIndex(dates, annotation),
  })).filter((entry): entry is { annotation: typeof entry.annotation; index: number } =>
    entry.index !== null
  );

  const tickIdxs = chooseTickIndices(n);

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {[0, 25, 50, 75, 100].map((g) => {
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
              fontSize={9}
              fontFamily="var(--f-mono)"
              fill="var(--ink-dim)"
            >
              {g}%
            </text>
          </g>
        );
      })}

      {tickIdxs.map((i) => (
        <text
          key={`x-${i}`}
          x={xAt(i)}
          y={VIEW_H - PAD_B + 15}
          textAnchor="middle"
          fontSize={9}
          fontFamily="var(--f-mono)"
          fill="var(--ink-dim)"
        >
          {fmtTickDate(dates[i])}
        </text>
      ))}

      {markers.map(({ annotation, index }) => {
        const x = xAt(index);
        return (
          <g key={annotation.date}>
            <line
              x1={x}
              x2={x}
              y1={PAD_T - 6}
              y2={VIEW_H - PAD_B}
              stroke="var(--accent)"
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={x}
              y={PAD_T - 9}
              textAnchor="middle"
              fontSize={9}
              fontFamily="var(--f-mono)"
              fill="var(--accent)"
            >
              {annotation.marker}
            </text>
          </g>
        );
      })}

      {n > 1 ? (
        <polyline
          points={linePoints}
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}

      {values.map((v, i) => (
        <circle
          key={`p-${i}`}
          cx={xAt(i)}
          cy={yAt(v)}
          r={n > 40 ? 1.4 : 2.2}
          fill={color}
        />
      ))}
    </svg>
  );
}

/** Legend for the era rules, shared by both panels of the exhibit. */
export function EraAnnotationLegend({ style }: { style?: CSSProperties }) {
  return (
    <div className="pooled-legend" style={style}>
      {ERA_ANNOTATIONS.map((annotation) => (
        <span key={annotation.date} className="pooled-legend__item">
          <span
            className="mono"
            style={{ color: "var(--accent)", fontSize: 11 }}
            aria-hidden
          >
            {annotation.marker}
          </span>
          <span>
            {fmtLegendDate(annotation.date)} · {annotation.label}
          </span>
        </span>
      ))}
    </div>
  );
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function chooseTickIndices(n: number): number[] {
  if (n <= 1) return n === 1 ? [0] : [];
  const target = n <= 4 ? n : 4;
  const step = Math.max(1, Math.round((n - 1) / (target - 1)));
  const out: number[] = [];
  for (let i = 0; i < n; i += step) out.push(i);
  if (out[out.length - 1] !== n - 1) out.push(n - 1);
  return out;
}

function fmtTickDate(iso: string): string {
  const [, mm, dd] = iso.split("-");
  return `${Number(mm)}/${Number(dd)}`;
}

function fmtLegendDate(iso: string): string {
  const [, mm, dd] = iso.split("-");
  const month = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ][Number(mm) - 1];
  return `${month} ${Number(dd)}`;
}
