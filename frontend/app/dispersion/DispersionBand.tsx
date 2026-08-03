"use client";

/**
 * The dispersion band (Director pick, approved as shown 2026-08-03).
 *
 * p25–p75 band with its own edge hairlines, the median as a single-series line
 * mark in the accent, a crosshair (pointer, touch, or keyboard) reading out the
 * day under it, and the bracket measuring today's disagreement.
 *
 * HARD RIDER: this plots the real series' real jaggedness. Every vertex is a
 * real day and every segment is a straight line between two of them — no
 * smoothing, no interpolation, no idealised curve. The mock's smooth lines were
 * placeholder only.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BracketMark } from "@/components/marks/BracketMark";

export type DispersionBandPoint = {
  date: string;
  p25: number;
  median: number;
  p75: number;
};

type DispersionBandProps = {
  data: DispersionBandPoint[];
  height?: number;
  title: string;
};

const PAD_L = 52;
/** Room to the right of the plot for the bracket and its label. */
const PAD_R = 148;
const PAD_T = 12;
const PAD_B = 42;
const FALLBACK_WIDTH = 1000;
/** Below this the two-line tag costs more plot than it is worth, so the
 *  bracket keeps its measurement and sheds the words. */
const NARROW = 560;

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

/** Dates arrive as plain `YYYY-MM-DD`; parsing them as instants would shift the
 *  label by a day west of UTC, so they are read as written. */
function shortDate(iso: string): string {
  const [, month, day] = iso.split("-");
  const index = Number(month) - 1;
  if (!MONTHS[index] || !day) return iso;
  return `${MONTHS[index]} ${Number(day)}`;
}

function usd(value: number): string {
  return `$${value.toFixed(2)}`;
}

/** Measures the plate so one user unit is one CSS pixel — which keeps pointer
 *  mapping exact and stops `meet` letterboxing the plot inside its panel. */
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

export function DispersionBand({
  data,
  height = 380,
  title,
}: DispersionBandProps) {
  const { ref, width } = useMeasuredWidth<HTMLDivElement>();
  const [cursor, setCursor] = useState<number | null>(null);

  const n = data.length;
  const H = height;
  const narrow = width < NARROW;
  const padL = narrow ? 44 : PAD_L;
  const padR = narrow ? 76 : PAD_R;
  const innerW = Math.max(width - padL - padR, 120);
  const innerH = H - PAD_T - PAD_B;

  const scale = useMemo(() => {
    const all = data.flatMap((d) => [d.p25, d.median, d.p75]);
    const min = all.length ? Math.min(...all) : 0;
    const max = all.length ? Math.max(...all) : 1;
    const span = max - min || Math.abs(min) * 0.02 || 0.01;
    const lo = min - span * 0.06;
    const hi = max + span * 0.06;
    return { lo, hi };
  }, [data]);

  const xAt = useCallback(
    (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW),
    [innerW, n, padL]
  );
  const yAt = useCallback(
    (v: number) =>
      PAD_T + (1 - (v - scale.lo) / (scale.hi - scale.lo || 1)) * innerH,
    [innerH, scale]
  );

  const indexFromX = useCallback(
    (x: number) => {
      if (n <= 1) return 0;
      const t = (x - padL) / (innerW || 1);
      return Math.min(n - 1, Math.max(0, Math.round(t * (n - 1))));
    },
    [innerW, n, padL]
  );

  const onPointer = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      // Some synthetic and assistive-tech pointer events arrive without
      // coordinates; leaving the crosshair where it is beats jumping to day one.
      if (!Number.isFinite(x)) return;
      setCursor(indexFromX(x));
    },
    [indexFromX]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<SVGSVGElement>) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const step = event.key === "ArrowLeft" ? -1 : 1;
      setCursor((current) => {
        const from = current ?? n - 1;
        return Math.min(n - 1, Math.max(0, from + step));
      });
    },
    [n]
  );

  if (!n) return null;

  const latest = data[n - 1];
  const readoutIndex = cursor ?? n - 1;
  const readout = data[readoutIndex];
  const spread = latest.p75 - latest.p25;

  const yTicks = Array.from({ length: 6 }, (_, k) => {
    const v = scale.lo + (k / 5) * (scale.hi - scale.lo);
    return { k, v, y: yAt(v) };
  });

  // Five dates fit a desktop axis; on a phone they run into each other.
  const xLabelIdx = Array.from(
    new Set(
      narrow
        ? [0, Math.floor(n * 0.5), n - 1]
        : [0, Math.floor(n * 0.25), Math.floor(n * 0.5), Math.floor(n * 0.75), n - 1]
    )
  );

  // Straight segments through every real vertex. No curve commands anywhere.
  const line = (pick: (d: DispersionBandPoint) => number) =>
    data
      .map((d, i) => `${i ? "L" : "M"}${xAt(i).toFixed(1)} ${yAt(pick(d)).toFixed(1)}`)
      .join(" ");

  const bandPath = [
    ...data.map(
      (d, i) => `${i ? "L" : "M"}${xAt(i).toFixed(1)} ${yAt(d.p75).toFixed(1)}`
    ),
    ...data
      .map((d, i) => ({ d, i }))
      .reverse()
      .map(({ d, i }) => `L${xAt(i).toFixed(1)} ${yAt(d.p25).toFixed(1)}`),
    "Z",
  ].join(" ");

  const plotRight = padL + innerW;
  const bracketSpine = plotRight + (narrow ? 16 : 26);
  const yHi = yAt(latest.p75);
  const yLo = yAt(latest.p25);
  const labelX = bracketSpine + (narrow ? 8 : 12);
  const labelMid = (yHi + yLo) / 2;

  return (
    <div className="dispersion-band" ref={ref}>
      <div className="dispersion-band__readout" role="status" aria-live="polite">
        <span>
          {cursor === null ? "Latest · " : ""}
          {shortDate(readout.date)} · p25 {usd(readout.p25)} · med{" "}
          {usd(readout.median)} · p75 {usd(readout.p75)}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${H}`}
        width="100%"
        height={H}
        className="dispersion-band__plate"
        role="img"
        tabIndex={0}
        aria-label={title}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setCursor(null)}
        onBlur={() => setCursor(null)}
        onKeyDown={onKeyDown}
      >
        <title>{title}</title>

        {yTicks.map(({ k, v, y }) => (
          <g key={k}>
            <line
              x1={padL}
              x2={plotRight}
              y1={y}
              y2={y}
              stroke="var(--line-lo)"
              strokeDasharray={k === 0 ? "0" : "2 4"}
            />
            <text
              className="dispersion-band__axis"
              x={padL - 8}
              y={y + 3}
              textAnchor="end"
            >
              {usd(v)}
            </text>
          </g>
        ))}

        {n > 1 ? (
          <>
            <path
              d={bandPath}
              className="dispersion-band__fill"
              fill="var(--accent)"
              fillOpacity={0.16}
              stroke="none"
            />
            <path
              d={line((d) => d.p75)}
              className="dispersion-band__edge"
              fill="none"
              stroke="var(--accent)"
              strokeOpacity={0.55}
              strokeWidth={1}
            />
            <path
              d={line((d) => d.p25)}
              className="dispersion-band__edge"
              fill="none"
              stroke="var(--accent)"
              strokeOpacity={0.55}
              strokeWidth={1}
            />
            <path
              d={line((d) => d.median)}
              className="dispersion-band__median"
              fill="none"
              stroke="var(--accent)"
              strokeWidth={1.8}
            />
          </>
        ) : (
          <SingleDay
            point={latest}
            x={xAt(0)}
            yAt={yAt}
            barWidth={Math.min(innerW * 0.24, 120)}
          />
        )}

        {cursor !== null ? (
          <g className="dispersion-band__crosshair">
            <line
              x1={xAt(cursor)}
              x2={xAt(cursor)}
              y1={PAD_T}
              y2={PAD_T + innerH}
              stroke="var(--ink)"
              strokeOpacity={0.5}
              strokeDasharray="2 3"
            />
            <circle
              cx={xAt(cursor)}
              cy={yAt(data[cursor].median)}
              r={3.5}
              fill="var(--accent)"
              stroke="var(--panel)"
              strokeWidth={1.5}
            />
          </g>
        ) : null}

        {/* Today's disagreement, measured. Ink: this brackets a price spread,
            not an unexplained share. */}
        <BracketMark
          spine={bracketSpine}
          start={yHi}
          length={Math.max(yLo - yHi, 6)}
          leaderFrom={xAt(n - 1)}
          leaderTo={bracketSpine + 8}
          tick={5}
          strokeWidth={1.2}
        />
        {narrow ? null : (
          <>
            <text className="dispersion-band__tag" x={labelX} y={labelMid - 9}>
              TODAY&apos;S
            </text>
            <text className="dispersion-band__tag" x={labelX} y={labelMid + 3}>
              DISAGREEMENT
            </text>
          </>
        )}
        <text
          className="dispersion-band__delta"
          x={labelX}
          y={narrow ? labelMid + 4 : labelMid + 18}
        >
          Δ {usd(spread)}
        </text>

        {xLabelIdx.map((i) => (
          <text
            key={data[i].date}
            className="dispersion-band__axis"
            x={xAt(i)}
            y={H - PAD_B + 18}
            textAnchor="middle"
          >
            {shortDate(data[i].date)}
          </text>
        ))}

        <rect
          x={padL}
          y={PAD_T}
          width={innerW}
          height={innerH}
          fill="transparent"
        />
      </svg>

      {narrow ? (
        <p className="dispersion-band__legend">
          Bracket: today&apos;s disagreement
        </p>
      ) : null}
    </div>
  );
}

function SingleDay({
  point,
  x,
  yAt,
  barWidth,
}: {
  point: DispersionBandPoint;
  x: number;
  yAt: (v: number) => number;
  barWidth: number;
}) {
  const y25 = yAt(point.p25);
  const y75 = yAt(point.p75);

  return (
    <>
      <rect
        className="dispersion-band__fill"
        x={x - barWidth / 2}
        y={Math.min(y25, y75)}
        width={barWidth}
        height={Math.max(Math.abs(y25 - y75), 2)}
        fill="var(--accent)"
        fillOpacity={0.16}
        rx={2}
      />
      <line
        className="dispersion-band__median"
        x1={x - barWidth / 2}
        x2={x + barWidth / 2}
        y1={yAt(point.median)}
        y2={yAt(point.median)}
        stroke="var(--accent)"
        strokeWidth={1.8}
      />
    </>
  );
}
