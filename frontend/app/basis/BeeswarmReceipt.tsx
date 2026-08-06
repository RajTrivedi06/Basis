"use client";

/**
 * Price beeswarm with an inline receipt (Director pick 1h, 2026-08-03).
 *
 * One row per group of the selected factor, prices laid out left-to-right on a
 * log axis, one dot per real offer packed into its row. Tapping a dot files its
 * receipt in the slot beneath the swarm — provider, commitment, price, and the
 * link into the existing provenance inspector.
 *
 * RIDER (no scroll jump): the receipt slot is always in the layout, holding its
 * own height whether or not a dot is selected. Nothing below the swarm moves
 * when a receipt files in.
 *
 * The plate is measured rather than scaled from a fixed viewBox, so one user
 * unit is one CSS pixel and the 44px touch target is 44 real pixels on a phone.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { factorColor, type Factor } from "@/lib/factorColor";
import { providerLabel } from "@/lib/providerLabel";
import type { SwarmPoint } from "./factorPoints";

export type BeeswarmReceiptProps = {
  factor: Factor;
  points: SwarmPoint[];
  gpuSku: string;
  onInspect: (rawObservationId: number) => void;
};

const DOT_R = 4.5;
/** The ruled minimum touch target: 44px across, so 22 from the centre. */
const TOUCH_R = 22;
/** Floor, not a fixed height: a row never gets tighter than the touch target,
 *  and a populous row grows so its dots stack instead of merging into a line. */
const ROW_H_MIN = 56;
const ROW_H_MAX = 104;
/** When many factor levels crowd the plate (region, residual cells), rows may
 *  compress down to this so the chart stays on one screen. */
const ROW_H_CROWDED = 32;
/**
 * Soft budget for the row stack (excludes top pad and axis). Provider /
 * commitment / bundle fit under this naturally; region and residual scale or
 * scroll instead of stretching the page.
 */
const PLOT_H_BUDGET = 560;
const SCROLL_H_CAP = 640;
const ROW_GAP = 6;
const ROW_LABEL_H = 15;
const PAD_T = 10;
const PAD_R = 16;
const AXIS_H = 28;
const LABEL_W = 132;
const FALLBACK_WIDTH = 900;
const NARROW = 560;
const TOTAL_FILE_IN_MS = 520;

const TICK_CANDIDATES = [
  0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 7.5, 10, 15, 20, 30, 50, 100,
];

function useMeasuredWidth<T extends Element>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(FALLBACK_WIDTH);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const next = entry.contentRect.width;
      if (next > 0) setWidth(next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

export function BeeswarmReceipt({
  factor,
  points,
  gpuSku,
  onInspect,
}: BeeswarmReceiptProps) {
  const { ref, width } = useMeasuredWidth<HTMLDivElement>();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const narrow = width < NARROW;
  const labelW = narrow ? 0 : LABEL_W;

  const layout = useMemo(
    () => buildLayout(points, width, labelW, narrow),
    [points, width, labelW, narrow]
  );

  // A factor switch replaces the whole population, so the open receipt is no
  // longer on screen; drop it rather than leave a card with no dot.
  useEffect(() => {
    setSelectedId(null);
  }, [factor]);

  const selected = useMemo(
    () => points.find((p) => p.canonicalOfferId === selectedId) ?? null,
    [points, selectedId]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<SVGSVGElement>) => {
      const step =
        event.key === "ArrowRight"
          ? 1
          : event.key === "ArrowLeft"
            ? -1
            : 0;
      const rowStep =
        event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
      if (!step && !rowStep) return;
      event.preventDefault();

      const order = layout.placed;
      if (order.length === 0) return;
      const current = order.findIndex(
        (p) => p.point.canonicalOfferId === selectedId
      );

      if (step) {
        const next = current < 0 ? 0 : clamp(current + step, 0, order.length - 1);
        setSelectedId(order[next].point.canonicalOfferId);
        return;
      }

      // Row jump: keep roughly the same place in the price order of the new row.
      const fromRow = current < 0 ? 0 : order[current].rowIndex;
      const toRow = clamp(fromRow + rowStep, 0, layout.rows.length - 1);
      if (toRow === fromRow && current >= 0) return;
      const inRow = order.filter((p) => p.rowIndex === toRow);
      if (inRow.length === 0) return;
      const fraction =
        current < 0
          ? 0
          : order.filter((p) => p.rowIndex === fromRow).findIndex(
              (p) => p.point.canonicalOfferId === selectedId
            ) /
            Math.max(1, order.filter((p) => p.rowIndex === fromRow).length - 1);
      const target = Math.round(fraction * (inRow.length - 1));
      setSelectedId(inRow[clamp(target, 0, inRow.length - 1)].point.canonicalOfferId);
    },
    [layout, selectedId]
  );

  if (points.length === 0 || layout.rows.length === 0) {
    return <EmptySwarm />;
  }

  // Grammar: the residual view is one undifferentiated cloud, so its dots are a
  // single-series mark in the accent; factor views stay on the categorical
  // palette the ledger and legend also speak.
  const dotColor = factor === "residual" ? "var(--accent)" : factorColor(factor);

  return (
    <div className="swarm" ref={ref}>
      <figure
        className={`swarm__figure${layout.scrollable ? " is-scroll" : ""}`}
      >
        <figcaption className="sr-only">{layout.summary}</figcaption>
        <svg
          className="swarm__plate"
          role="img"
          aria-label={`${layout.summary} Use the arrow keys to read one offer at a time.`}
          viewBox={`0 0 ${width} ${layout.height}`}
          width="100%"
          height={layout.height}
          tabIndex={0}
          onKeyDown={onKeyDown}
        >
          {layout.ticks.map((t) => (
            <g key={t.value}>
              <line
                x1={t.x}
                x2={t.x}
                y1={PAD_T}
                y2={layout.height - AXIS_H}
                stroke="var(--line-lo)"
              />
              <text
                className="swarm__axis"
                x={t.x}
                y={layout.height - AXIS_H + 16}
                textAnchor="middle"
              >
                ${formatDollar(t.value)}
              </text>
            </g>
          ))}

          <line
            x1={labelW}
            x2={width - PAD_R}
            y1={layout.height - AXIS_H}
            y2={layout.height - AXIS_H}
            stroke="var(--line)"
          />

          {layout.rows.map((row) => (
            <g key={row.key}>
              <text
                className={
                  row.key === "UNKNOWN"
                    ? "swarm__row-label is-unknown"
                    : "swarm__row-label"
                }
                x={narrow ? labelW : LABEL_W - 12}
                y={narrow ? row.top - 4 : row.centre + 3}
                textAnchor={narrow ? "start" : "end"}
              >
                {row.label}
              </text>
              <text
                className="swarm__row-count"
                x={narrow ? width - PAD_R : LABEL_W - 12}
                y={narrow ? row.top - 4 : row.centre + 15}
                textAnchor="end"
              >
                {row.count}
              </text>
            </g>
          ))}

          {layout.placed.map((p, i) => {
            const isSelected = p.point.canonicalOfferId === selectedId;
            return (
              <circle
                key={p.point.canonicalOfferId}
                className="swarm__dot"
                style={{
                  ["--swarm-delay" as string]: `${(
                    (i / Math.max(1, layout.placed.length)) *
                    TOTAL_FILE_IN_MS
                  ).toFixed(0)}ms`,
                }}
                aria-hidden="true"
                cx={p.x}
                cy={p.y}
                r={isSelected ? DOT_R + 2 : DOT_R}
                fill={p.point.isUnknown ? "var(--unknown)" : dotColor}
                fillOpacity={isSelected ? 1 : 0.72}
                stroke={isSelected ? "var(--panel)" : "none"}
                strokeWidth={isSelected ? 2 : 0}
              />
            );
          })}

          {layout.placed
            .filter((p) => p.point.canonicalOfferId === selectedId)
            .map((p) => (
              <circle
                key={`halo-${p.point.canonicalOfferId}`}
                className="swarm__halo"
                aria-hidden="true"
                cx={p.x}
                cy={p.y}
                r={DOT_R + 6}
                fill="none"
                stroke="var(--ink)"
                strokeOpacity={0.5}
              />
            ))}

          {/* Touch layer. A tap anywhere within the ruled 44px of a dot picks
              it; where dots crowd closer than that, the nearest one wins. Giving
              each dot its own 44px circle instead would stack the circles on a
              dense row and leave the covered dots unreachable, which defeats
              the point of the target. */}
          <rect
            className="swarm__hit"
            data-testid="swarm-hit-layer"
            x={0}
            y={0}
            width={width}
            height={layout.height - AXIS_H}
            fill="transparent"
            onClick={(event) => {
              const nearest = nearestTo(event, layout.placed);
              if (nearest !== null) setSelectedId(nearest);
            }}
          />
        </svg>
      </figure>

      {/* Reserved slot — present and holding its height before any tap, so
          filing a receipt never moves the page under the reader. */}
      <div className="swarm__receipt-slot" data-testid="swarm-receipt-slot">
        {selected ? (
          <Receipt point={selected} gpuSku={gpuSku} onInspect={onInspect} />
        ) : (
          <p className="swarm__receipt-hint">
            Select a dot to file its receipt.
          </p>
        )}
      </div>
    </div>
  );
}

function Receipt({
  point,
  gpuSku,
  onInspect,
}: {
  point: SwarmPoint;
  gpuSku: string;
  onInspect: (rawObservationId: number) => void;
}) {
  return (
    <article className="swarm__receipt" aria-live="polite">
      <div className="swarm__receipt-eyebrow">
        Receipt · offer #{point.canonicalOfferId}
      </div>
      <div className="swarm__receipt-head">
        <span className="swarm__receipt-who">
          {providerLabel(point.provider)}
          <span className="swarm__receipt-terms">
            {" "}
            · {point.commitmentType} · {gpuSku}
          </span>
        </span>
        <span className="swarm__receipt-price">
          ${point.price.toFixed(2)}
          <span className="swarm__receipt-unit">/hr</span>
        </span>
      </div>
      <button
        type="button"
        className="swarm__receipt-link"
        onClick={() => onInspect(point.rawObservationId)}
      >
        Inspect provenance →
      </button>
    </article>
  );
}

/**
 * The offer nearest the tap, or null if the tap landed further than the ruled
 * touch radius from every dot. The plate is measured in CSS pixels, so client
 * coordinates map straight onto the layout.
 */
function nearestTo(
  event: React.MouseEvent<SVGRectElement>,
  placed: PlacedPoint[]
): number | null {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  let best: PlacedPoint | null = null;
  let bestDistance = Infinity;
  for (const p of placed) {
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = p;
    }
  }
  if (!best || bestDistance > TOUCH_R ** 2) return null;
  return best.point.canonicalOfferId;
}

function EmptySwarm() {
  return (
    <div className="swarm">
      <p className="caption swarm__empty">No observations to plot.</p>
    </div>
  );
}

// ---------- layout ----------

type PlacedPoint = { point: SwarmPoint; x: number; y: number; rowIndex: number };

type Row = {
  key: string;
  label: string;
  count: number;
  top: number;
  height: number;
  centre: number;
};

type Layout = {
  rows: Row[];
  placed: PlacedPoint[];
  ticks: { value: number; x: number }[];
  height: number;
  summary: string;
  /** True when the plate still exceeds the scroll cap after row compression. */
  scrollable: boolean;
};

function buildLayout(
  points: SwarmPoint[],
  width: number,
  labelW: number,
  narrow: boolean
): Layout {
  const labelByKey: Record<string, string> = {};
  const counts = new Map<string, number>();
  for (const p of points) {
    labelByKey[p.groupKey] = p.groupLabel;
    counts.set(p.groupKey, (counts.get(p.groupKey) ?? 0) + 1);
  }

  const named = [...counts]
    .filter(([k]) => k !== "UNKNOWN")
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);
  const groupOrder = counts.has("UNKNOWN") ? [...named, "UNKNOWN"] : named;

  const labelBand = narrow ? ROW_LABEL_H : 0;
  // Narrow mode stacks a label above every row, so the budget has to leave
  // room for those bands or region/residual still blow the page open.
  const bandTax = groupOrder.length * labelBand;
  const heights = rowHeights(
    groupOrder.map((key) => counts.get(key) ?? 0),
    bandTax
  );

  let cursor = PAD_T;
  const rows: Row[] = groupOrder.map((key, i) => {
    const count = counts.get(key) ?? 0;
    const height = heights[i] ?? ROW_H_MIN;
    const top = cursor + labelBand;
    cursor = top + height + ROW_GAP;
    return {
      key,
      label: labelByKey[key] ?? key,
      count,
      top,
      height,
      centre: top + height / 2,
    };
  });

  const height = cursor + AXIS_H;
  const scrollable = height > SCROLL_H_CAP;

  const x0 = labelW + 8;
  const x1 = Math.max(x0 + 40, width - PAD_R);

  const prices = points.map((p) => p.price).filter((v) => v > 0);
  const lo = prices.length ? Math.min(...prices) : 1;
  const hi = prices.length ? Math.max(...prices) : 1;
  const logLo = Math.log(lo) - 0.1;
  const logHi = Math.log(hi) + 0.1;
  const span = logHi - logLo || 1;
  const xAt = (price: number) =>
    x0 + ((Math.log(Math.max(price, 1e-6)) - logLo) / span) * (x1 - x0);

  const rowIndexByKey = new Map(groupOrder.map((k, i) => [k, i]));
  const placed: PlacedPoint[] = [];
  for (const row of rows) {
    const rowIndex = rowIndexByKey.get(row.key) ?? 0;
    const inRow = points
      .filter((p) => p.groupKey === row.key)
      .sort((a, b) => a.price - b.price);
    for (const seat of packRow(inRow, xAt, row.height / 2 - DOT_R)) {
      placed.push({
        point: seat.point,
        x: seat.x,
        y: row.centre + seat.dy,
        rowIndex,
      });
    }
  }

  const ticks = TICK_CANDIDATES.filter((v) => v >= lo * 0.9 && v <= hi * 1.1)
    .map((value) => ({ value, x: xAt(value) }))
    .filter((_, i, all) => all.length <= 6 || i % Math.ceil(all.length / 5) === 0);

  return {
    rows,
    placed,
    ticks,
    height,
    summary: summarise(points, rows),
    scrollable,
  };
}

/**
 * Seat one row's dots. Points arrive in price order; each takes the slot
 * closest to the row's centre line that no near neighbour already holds. A
 * saturated row lets its dots overlap rather than spilling into the next row.
 */
function packRow(
  inRow: SwarmPoint[],
  xAt: (price: number) => number,
  halfBand: number
): { point: SwarmPoint; x: number; dy: number }[] {
  const pitch = DOT_R * 2 + 1;
  const lanes = Math.max(0, Math.floor(halfBand / pitch));
  const seated: { point: SwarmPoint; x: number; dy: number }[] = [];

  for (const point of inRow) {
    const x = xAt(point.price);
    // Sorted by x, so only the tail can be within a dot's width.
    let from = seated.length - 1;
    while (from >= 0 && x - seated[from].x < pitch) from -= 1;
    const neighbours = seated.slice(from + 1);

    let dy = 0;
    for (let k = 0; k <= lanes; k++) {
      const candidates = k === 0 ? [0] : [k * pitch, -k * pitch];
      const free = candidates.find(
        (c) => !neighbours.some((q) => Math.abs(q.dy - c) < pitch)
      );
      if (free !== undefined) {
        dy = free;
        break;
      }
    }
    seated.push({ point, x, dy });
  }

  return seated;
}

function summarise(points: SwarmPoint[], rows: Row[]): string {
  const n = points.length;
  const sorted = points.map((p) => p.price).sort((a, b) => a - b);
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;
  return (
    `Beeswarm of ${n} offer${n === 1 ? "" : "s"} across ${rows.length} ` +
    `row${rows.length === 1 ? "" : "s"}, priced $${min.toFixed(2)} to ` +
    `$${max.toFixed(2)} per GPU per hour.`
  );
}

/** A row grows with its population so a dense one stacks rather than merging
 *  into a single line, and never shrinks below the touch target. */
function rowHeight(count: number): number {
  const pitch = DOT_R * 2 + 1;
  // Two extra lanes each side per 60 offers, which is roughly where the
  // five-lane band starts overplotting on live H100 data.
  const grown = ROW_H_MIN + Math.floor(count / 60) * pitch * 2;
  return clamp(grown, ROW_H_MIN, ROW_H_MAX);
}

/**
 * Ideal per-row heights, then uniformly compressed when the stack would blow
 * past the soft budget (region / residual). `bandTax` is the extra vertical
 * taken by per-row labels in narrow layout.
 */
function rowHeights(counts: number[], bandTax = 0): number[] {
  if (counts.length === 0) return [];
  const ideals = counts.map(rowHeight);
  const gaps = Math.max(0, counts.length - 1) * ROW_GAP;
  const idealSum = ideals.reduce((sum, h) => sum + h, 0);
  const idealTotal = idealSum + gaps + bandTax;
  if (idealTotal <= PLOT_H_BUDGET) return ideals;

  const n = counts.length;
  const budgetForRows = PLOT_H_BUDGET - gaps - bandTax;
  const crowdedFloor = n * ROW_H_CROWDED;

  // Fit inside the budget when crowded-min rows would; otherwise accept the
  // crowded floor and let the plate scroll inside SCROLL_H_CAP.
  if (budgetForRows >= crowdedFloor && idealSum > 0) {
    const scale = budgetForRows / idealSum;
    return ideals.map((h) =>
      clamp(Math.round(h * scale), ROW_H_CROWDED, ROW_H_MAX)
    );
  }
  return ideals.map(() => ROW_H_CROWDED);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function formatDollar(v: number): string {
  if (v >= 10) return v.toFixed(0);
  if (v >= 1) return v.toFixed(1).replace(/\.0$/, "");
  return v.toFixed(2);
}
