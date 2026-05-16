"use client";

import { useMemo, useRef } from "react";
import { factorColor, type Factor } from "@/lib/factorColor";
import { providerLabel } from "@/lib/providerLabel";
import type { DecompositionObservation } from "@/lib/types";

/**
 * Hand-built SVG strip plot of price vs. one categorical factor.
 *
 * One column per group on the X axis (group population descending,
 * UNKNOWN always pinned right), one dot per observation, jittered
 * deterministically inside its column. Y axis is log $/hr. Per-group
 * median line + IQR band overlay when n ≥ 3.
 *
 * The chart is the centerpiece of the factor-aware drilldown drawer:
 * tight columns mean the factor "explains" price; spread columns
 * mean it doesn't. For the residual view, dots are amber and the
 * X axis is provider × commitment cells — within-cell spread is the
 * residual basis risk.
 *
 * Conventions match ResidualTimeSeriesChart.tsx: fixed viewBox,
 * explicit projection helpers, vectorEffect="non-scaling-stroke",
 * no chart library.
 */

const VIEW_W = 820;
const VIEW_H = 320;
const PAD = { top: 24, right: 24, bottom: 56, left: 56 };
const PLOT_W = VIEW_W - PAD.left - PAD.right; // 740
const PLOT_H = VIEW_H - PAD.top - PAD.bottom; // 240

const DOT_RADIUS = 3;
const DOT_RADIUS_HOVER = 5;
const TOTAL_REVEAL_MS = 600;

const Y_TICK_CANDIDATES = [
  0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 7.5, 10, 15, 20, 30, 50, 100,
];

export type StripPlotPoint = {
  canonicalOfferId: number;
  rawObservationId: number;
  price: number;
  groupKey: string;
  groupLabel: string;
  isUnknown: boolean;
  // Carried through for the tooltip and aria summary.
  provider: string;
  commitmentType: string;
  regionLabel: string;
};

export type FactorStripPlotProps = {
  factor: Factor;
  points: StripPlotPoint[];
  hoveredOfferId?: number | null;
  onPointHover?: (point: StripPlotPoint | null) => void;
  onPointClick?: (point: StripPlotPoint) => void;
};

/**
 * Build strip-plot points from raw observations for the given factor.
 * Bundle quartiles are computed across the input set, so the bins
 * change with the dataset — this is intentional: the view is meant
 * to surface within-bin spread for the offers shown.
 */
export function pointsFromObservations(
  factor: Factor,
  observations: DecompositionObservation[]
): StripPlotPoint[] {
  const common = (o: DecompositionObservation) => ({
    canonicalOfferId: o.canonical_offer_id,
    rawObservationId: o.raw_observation_id,
    price: o.price_usd_per_hour,
    provider: o.provider,
    commitmentType: o.commitment_type,
    regionLabel: regionLabelFor(o),
  });

  switch (factor) {
    case "region":
      return observations.map((o) => ({
        ...common(o),
        groupKey: o.region_country ?? "UNKNOWN",
        groupLabel: o.region_country ?? "UNKNOWN",
        isUnknown: o.region_country === null,
      }));

    case "commitment":
      return observations.map((o) => ({
        ...common(o),
        groupKey: o.commitment_type,
        groupLabel: o.commitment_type,
        isUnknown: false,
      }));

    case "provider":
      return observations.map((o) => ({
        ...common(o),
        groupKey: o.provider,
        groupLabel: providerLabel(o.provider),
        isUnknown: false,
      }));

    case "bundle": {
      const isAllNull = (o: DecompositionObservation) =>
        o.vcpus_bundled === null &&
        o.ram_gb_bundled === null &&
        o.storage_gb_bundled === null;

      const score = (o: DecompositionObservation) =>
        (o.vcpus_bundled ?? 0) * 1 +
        (o.ram_gb_bundled ?? 0) * 0.2 +
        (o.storage_gb_bundled ?? 0) * 0.001;

      const sized = observations
        .filter((o) => !isAllNull(o))
        .map(score)
        .sort((a, b) => a - b);

      const q1 = quantile(sized, 0.25);
      const q2 = quantile(sized, 0.5);
      const q3 = quantile(sized, 0.75);

      const bin = (s: number): string =>
        s < q1 ? "small" : s < q2 ? "medium" : s < q3 ? "large" : "x-large";

      return observations.map((o) => {
        const isUnknown = isAllNull(o);
        const key = isUnknown ? "UNKNOWN" : bin(score(o));
        return {
          ...common(o),
          groupKey: key,
          groupLabel: key,
          isUnknown,
        };
      });
    }

    case "residual":
      // Conditioning on (provider, commitment) — within-cell spread is
      // the residual. groupLabel is two-line for unrotated rendering;
      // the chart falls back to a single-line "Provider · commitment"
      // form when the X axis triggers rotation.
      return observations.map((o) => ({
        ...common(o),
        groupKey: `${o.provider}|${o.commitment_type}`,
        groupLabel: `${providerLabel(o.provider)}\n${o.commitment_type}`,
        isUnknown: false,
      }));
  }
}

export function FactorStripPlot({
  factor,
  points,
  hoveredOfferId = null,
  onPointHover,
  onPointClick,
}: FactorStripPlotProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const tooltipContentRef = useRef<HTMLDivElement | null>(null);

  const layout = useMemo(() => buildLayout(points), [points]);

  if (points.length === 0 || layout.groupOrder.length === 0) {
    return <EmptyChart />;
  }

  const dotColor = factor === "residual" ? "var(--residual)" : factorColor(factor);
  const figureSummary = buildFigureSummary(factor, points, layout);

  // Cursor-following tooltip: position the tooltip via direct DOM
  // mutation in mousemove so we don't trigger a React render at 60fps.
  // hoveredOfferId is React state (changes only on enter/leave) and
  // governs both the dot's hover-bump and the table-row highlight.
  const updateTooltipPosition = (clientX: number, clientY: number) => {
    const container = containerRef.current;
    const tooltip = tooltipRef.current;
    if (!container || !tooltip) return;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left + 12;
    const y = clientY - rect.top + 12;
    // Keep the tooltip on-canvas if it would clip the right edge.
    const maxX = rect.width - tooltip.offsetWidth - 8;
    const maxY = rect.height - tooltip.offsetHeight - 8;
    tooltip.style.transform = `translate(${Math.min(x, Math.max(0, maxX))}px, ${Math.min(
      y,
      Math.max(0, maxY)
    )}px)`;
  };

  const showTooltip = (point: StripPlotPoint, e: React.MouseEvent) => {
    const tooltip = tooltipRef.current;
    const content = tooltipContentRef.current;
    if (tooltip && content) {
      content.textContent = tooltipText(point);
      tooltip.style.opacity = "1";
      updateTooltipPosition(e.clientX, e.clientY);
    }
    onPointHover?.(point);
  };

  const hideTooltip = () => {
    const tooltip = tooltipRef.current;
    if (tooltip) tooltip.style.opacity = "0";
    onPointHover?.(null);
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <figure style={{ margin: 0 }}>
        <figcaption className="sr-only">{figureSummary}</figcaption>
        <svg
          role="img"
          aria-label={figureSummary}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: "100%", height: "auto", display: "block" }}
          onMouseLeave={hideTooltip}
        >
          {/* Y gridlines + dollar labels */}
          {layout.yTicks.map((t) => {
            const y = layout.yAt(t);
            return (
              <g key={`y-${t}`}>
                <line
                  x1={PAD.left}
                  x2={VIEW_W - PAD.right}
                  y1={y}
                  y2={y}
                  stroke="var(--line-lo)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={PAD.left - 8}
                  y={y}
                  dy="0.32em"
                  textAnchor="end"
                  fontSize={10}
                  fontFamily="var(--f-mono)"
                  fill="var(--ink-dim)"
                >
                  ${formatDollar(t)}
                </text>
              </g>
            );
          })}

          {/* X-axis baseline */}
          <line
            x1={PAD.left}
            x2={VIEW_W - PAD.right}
            y1={PAD.top + PLOT_H}
            y2={PAD.top + PLOT_H}
            stroke="var(--line)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />

          {/* IQR bands + median lines per group (≥3 obs only) */}
          <g className="basis-strip-stat">
            {layout.groupOrder.map((key, gi) => {
              const stat = layout.statsByGroup[key];
              if (!stat) return null;
              const xc = layout.xCenter(gi);
              const halfW = layout.colWidth * 0.35;
              const isUnknown = key === "UNKNOWN";
              const groupColor = isUnknown ? "var(--unknown)" : dotColor;
              const bandFill =
                factor === "residual" && !isUnknown
                  ? "var(--residual-bg)"
                  : isUnknown
                    ? "var(--unknown-bg)"
                    : groupColor;
              const yQ1 = layout.yAt(stat.q1);
              const yQ3 = layout.yAt(stat.q3);
              const yMed = layout.yAt(stat.median);
              const top = Math.min(yQ1, yQ3);
              const h = Math.max(2, Math.abs(yQ1 - yQ3));
              return (
                <g key={`stat-${key}`}>
                  <rect
                    x={xc - halfW}
                    y={top}
                    width={halfW * 2}
                    height={h}
                    fill={bandFill}
                    fillOpacity={
                      factor === "residual" && !isUnknown
                        ? 1
                        : isUnknown
                          ? 1
                          : 0.12
                    }
                  />
                  <line
                    x1={xc - halfW}
                    x2={xc + halfW}
                    y1={yMed}
                    y2={yMed}
                    stroke={groupColor}
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}
          </g>

          {/* Dots */}
          {layout.placedPoints.map((pp, i) => {
            const isHovered = pp.point.canonicalOfferId === hoveredOfferId;
            const color = pp.point.isUnknown ? "var(--unknown)" : dotColor;
            const delayMs = (i / Math.max(1, layout.placedPoints.length)) *
              TOTAL_REVEAL_MS;
            return (
              <circle
                key={pp.point.canonicalOfferId}
                className="basis-strip-dot"
                style={{
                  ["--basis-delay" as string]: `${delayMs.toFixed(0)}ms`,
                  cursor: "pointer",
                }}
                aria-hidden="true"
                cx={pp.x}
                cy={pp.y}
                r={isHovered ? DOT_RADIUS_HOVER : DOT_RADIUS}
                fill={color}
                fillOpacity={isHovered ? 1 : 0.75}
                stroke={isHovered ? "var(--bg)" : "none"}
                strokeWidth={isHovered ? 1.25 : 0}
                onMouseEnter={(e) => showTooltip(pp.point, e)}
                onMouseMove={(e) => updateTooltipPosition(e.clientX, e.clientY)}
                onMouseLeave={hideTooltip}
                onClick={() => onPointClick?.(pp.point)}
              />
            );
          })}

          {/* X-axis group labels */}
          {layout.groupOrder.map((key, gi) => {
            const xc = layout.xCenter(gi);
            const yLabel = PAD.top + PLOT_H + 14;
            const fill = key === "UNKNOWN" ? "var(--unknown)" : "var(--ink-mid)";
            if (layout.rotateLabels) {
              const single = singleLineLabel(key, layout.labelByKey[key]);
              return (
                <text
                  key={`xl-${key}`}
                  x={xc}
                  y={yLabel}
                  textAnchor="end"
                  fontSize={10}
                  fontFamily="var(--f-mono)"
                  fill={fill}
                  transform={`rotate(-30, ${xc}, ${yLabel})`}
                >
                  {single}
                </text>
              );
            }
            const label = layout.labelByKey[key];
            const lines = label.split("\n");
            return (
              <text
                key={`xl-${key}`}
                x={xc}
                y={yLabel}
                textAnchor="middle"
                fontSize={10}
                fontFamily="var(--f-mono)"
                fill={fill}
              >
                {lines.map((line, li) => (
                  <tspan key={li} x={xc} dy={li === 0 ? 0 : "1.1em"}>
                    {line}
                  </tspan>
                ))}
              </text>
            );
          })}
        </svg>
      </figure>

      {/* Tooltip — absolute within this container, transform-positioned
          via DOM mutation so cursor-tracking doesn't re-render React. */}
      <div
        ref={tooltipRef}
        role="presentation"
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          opacity: 0,
          transform: "translate(0px, 0px)",
          pointerEvents: "none",
          background: "var(--panel)",
          border: "1px solid var(--line-hi)",
          borderRadius: "var(--r-sm)",
          padding: "6px 10px",
          fontSize: 11,
          color: "var(--ink)",
          maxWidth: 320,
          boxShadow: "var(--shadow-md)",
          fontFamily: "var(--f-mono)",
          whiteSpace: "nowrap",
          transition: "opacity 100ms ease",
          zIndex: 5,
        }}
      >
        <div ref={tooltipContentRef} />
      </div>
    </div>
  );
}

// ---------- helpers ----------

type Layout = {
  groupOrder: string[];
  labelByKey: Record<string, string>;
  rotateLabels: boolean;
  colWidth: number;
  xCenter: (gi: number) => number;
  yAt: (price: number) => number;
  yTicks: number[];
  statsByGroup: Record<
    string,
    { median: number; q1: number; q3: number; count: number }
  >;
  placedPoints: { point: StripPlotPoint; x: number; y: number }[];
};

function buildLayout(points: StripPlotPoint[]): Layout {
  const labelByKey: Record<string, string> = {};
  const counts = new Map<string, number>();
  for (const p of points) {
    labelByKey[p.groupKey] = p.groupLabel;
    counts.set(p.groupKey, (counts.get(p.groupKey) ?? 0) + 1);
  }

  const named: string[] = [...counts]
    .filter(([k]) => k !== "UNKNOWN")
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);
  const groupOrder = counts.has("UNKNOWN") ? [...named, "UNKNOWN"] : named;

  const G = Math.max(1, groupOrder.length);
  const colWidth = PLOT_W / G;
  const xCenter = (gi: number) => PAD.left + colWidth * (gi + 0.5);

  const prices = points.map((p) => p.price).filter((v) => v > 0);
  const lo = prices.length ? Math.min(...prices) : 1;
  const hi = prices.length ? Math.max(...prices) : 1;
  // 0.12 in log space ≈ ±13% multiplicative breathing room; just enough
  // visual padding above the highest dot without distorting the scale.
  const logLo = Math.log(lo) - 0.12;
  const logHi = Math.log(hi) + 0.12;
  const span = logHi - logLo || 1;
  const yAt = (price: number) =>
    PAD.top + (1 - (Math.log(price) - logLo) / span) * PLOT_H;

  const yTicks = pickYTicks(lo, hi);

  const statsByGroup: Record<
    string,
    { median: number; q1: number; q3: number; count: number }
  > = {};
  for (const key of groupOrder) {
    const groupPrices = points
      .filter((p) => p.groupKey === key)
      .map((p) => p.price)
      .sort((a, b) => a - b);
    if (groupPrices.length < 3) continue;
    statsByGroup[key] = {
      median: median(groupPrices),
      q1: quantile(groupPrices, 0.25),
      q3: quantile(groupPrices, 0.75),
      count: groupPrices.length,
    };
  }

  const groupIndex = new Map(groupOrder.map((k, i) => [k, i]));
  const placedPoints = points.map((point) => {
    const gi = groupIndex.get(point.groupKey) ?? 0;
    const j = jitter(point.canonicalOfferId);
    const x = xCenter(gi) + j * colWidth * 0.4;
    const y = yAt(Math.max(point.price, 1e-6));
    return { point, x, y };
  });

  const longest = Math.max(
    ...groupOrder.map((k) => singleLineLabel(k, labelByKey[k]).length)
  );
  const rotateLabels = groupOrder.length > 6 || longest > 8;

  return {
    groupOrder,
    labelByKey,
    rotateLabels,
    colWidth,
    xCenter,
    yAt,
    yTicks,
    statsByGroup,
    placedPoints,
  };
}

function buildFigureSummary(
  factor: Factor,
  points: StripPlotPoint[],
  layout: Layout
): string {
  const n = points.length;
  const G = layout.groupOrder.length;
  const factorWord =
    factor === "residual"
      ? "provider × commitment cells"
      : factor === "region"
        ? "country"
        : factor === "commitment"
          ? "commitment type"
          : factor === "provider"
            ? "provider"
            : "bundle quartile";
  const all = points.map((p) => p.price).sort((a, b) => a - b);
  const med = all.length ? median(all) : 0;
  const min = all.length ? all[0] : 0;
  const max = all.length ? all[all.length - 1] : 0;
  return (
    `Strip plot of price vs ${factorWord} for ${n} observation${n === 1 ? "" : "s"} ` +
    `across ${G} group${G === 1 ? "" : "s"}. Median price $${med.toFixed(2)} per ` +
    `GPU per hour; range $${min.toFixed(2)} to $${max.toFixed(2)}.`
  );
}

function tooltipText(p: StripPlotPoint): string {
  return `${providerLabel(p.provider)} · $${p.price.toFixed(2)}/hr · ${p.commitmentType} · ${p.regionLabel}`;
}

function regionLabelFor(o: DecompositionObservation): string {
  if (o.region_country === null) return "UNKNOWN";
  if (o.region_state) return `${o.region_country} · ${o.region_state}`;
  return o.region_country;
}

function singleLineLabel(key: string, label: string): string {
  // Two-line residual labels collapse to "Provider · commitment" when
  // the X axis triggers rotation — explicit `\n` in the supplied label
  // is the signal that we need to flatten.
  if (label.includes("\n")) return label.replace(/\n/g, " · ");
  if (key.includes("|")) return key.replace("|", " · ");
  return label;
}

function jitter(id: number): number {
  // Deterministic 32-bit hash → [-1, 1]. Stable across re-renders so
  // dots don't twitch on hover.
  let h = (id ^ 0x9e3779b1) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h = (h ^ (h >>> 16)) >>> 0;
  return (h / 0xffffffff) * 2 - 1;
}

function pickYTicks(lo: number, hi: number): number[] {
  const inRange = Y_TICK_CANDIDATES.filter((t) => t >= lo * 0.85 && t <= hi * 1.15);
  if (inRange.length <= 6) return inRange;
  const step = Math.ceil(inRange.length / 5);
  return inRange.filter((_, i) => i % step === 0);
}

function formatDollar(v: number): string {
  if (v >= 10) return v.toFixed(0);
  if (v >= 1) return v.toFixed(1).replace(/\.0$/, "");
  return v.toFixed(2);
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return base + 1 < sorted.length
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

function EmptyChart() {
  return (
    <div
      className="caption"
      style={{
        height: VIEW_H,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--ink-dim)",
        background: "var(--panel-hi)",
        border: "1px solid var(--line-lo)",
        borderRadius: 2,
      }}
    >
      No observations to plot.
    </div>
  );
}
