"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The dimension bracket — the site's one bespoke mark (design doc §13,
 * exploration variant 1c). Two leader hairlines, a spine between them, a 45°
 * drafting tick at each end, and a gap holding an italic serif label.
 *
 * Tone follows ADR-0005: `ink` everywhere the bracket measures a plain gap,
 * `void` only where the thing being measured IS the unexplained share.
 */
export type BracketTone = "ink" | "void";

function toneStroke(tone: BracketTone): string {
  return tone === "void" ? "var(--residual)" : "var(--ink)";
}

/**
 * Draw-once reveal. The resting CSS is the *finished* bracket, so server HTML,
 * a JS-less client, and reduced-motion all show a complete mark; the class this
 * returns only replays the draw as a one-shot animation on first view. Nothing
 * loops (design doc §13, motion law 2).
 */
export function useDrawOnce<T extends Element>() {
  const ref = useRef<T | null>(null);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setDrawing(true);
        observer.disconnect();
      },
      { threshold: 0.35 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, drawing };
}

export interface BracketMarkProps {
  /** `vertical` measures a gap between two horizontal edges, and vice versa. */
  orientation?: "vertical" | "horizontal";
  /** Spine position on the cross axis — x when vertical, y when horizontal. */
  spine: number;
  /** Start of the measured span on the main axis. */
  start: number;
  /** Length of the measured span, in the parent SVG's user units. */
  length: number;
  tone?: BracketTone;
  strokeWidth?: number;
  /** Half-length of the 45° end ticks. */
  tick?: number;
  /** Gap between the measured edge and the spine's end. */
  inset?: number;
  /** Leader hairlines run across these two cross-axis coordinates. */
  leaderFrom?: number;
  leaderTo?: number;
  /** Italic serif label set in the bracket's gap. */
  label?: string;
  labelSize?: number;
  /** Cross-axis distance from the spine to the label. */
  labelOffset?: number;
  className?: string;
}

/**
 * Renders as an SVG `<g>` so it composes into any parent chart. Callers that
 * need a standalone mark wrap it in their own `<svg>`.
 */
export function BracketMark({
  orientation = "vertical",
  spine,
  start,
  length,
  tone = "ink",
  strokeWidth = 1.5,
  tick = 7,
  inset = 4,
  leaderFrom,
  leaderTo,
  label,
  labelSize = 22,
  labelOffset = 16,
  className = "",
}: BracketMarkProps) {
  const stroke = toneStroke(tone);
  const near = start + inset;
  const far = start + length - inset;
  const middle = start + length / 2;
  const hasLeaders = leaderFrom != null && leaderTo != null;
  const vertical = orientation === "vertical";

  // A tick is a 45° slash centred on the spine's end — drafting grammar, so
  // both ends slash the same way rather than mirroring into a chevron.
  const tickPoints = (main: number) =>
    vertical
      ? {
          x1: spine - tick,
          y1: main + tick,
          x2: spine + tick,
          y2: main - tick,
        }
      : {
          x1: main - tick,
          y1: spine + tick,
          x2: main + tick,
          y2: spine - tick,
        };

  const leader = (main: number) =>
    vertical
      ? { x1: leaderFrom, y1: main, x2: leaderTo, y2: main }
      : { x1: main, y1: leaderFrom, x2: main, y2: leaderTo };

  const nearTick = tickPoints(near);
  const farTick = tickPoints(far);

  return (
    <g className={`bracket-mark ${className}`.trim()} aria-hidden>
      {hasLeaders ? (
        <line
          {...leader(start)}
          className="bracket-mark__seg bracket-mark__leader"
          style={{ "--bracket-delay": "0ms" } as React.CSSProperties}
          stroke="var(--ink-faint)"
          strokeWidth={0.8}
          pathLength={1}
        />
      ) : null}

      <line
        {...nearTick}
        className="bracket-mark__seg"
        style={{ "--bracket-delay": "0ms" } as React.CSSProperties}
        stroke={stroke}
        strokeWidth={strokeWidth}
        pathLength={1}
      />

      <line
        x1={vertical ? spine : near}
        y1={vertical ? near : spine}
        x2={vertical ? spine : far}
        y2={vertical ? far : spine}
        className="bracket-mark__seg bracket-mark__spine"
        style={{ "--bracket-delay": "90ms" } as React.CSSProperties}
        stroke={stroke}
        strokeWidth={strokeWidth}
        pathLength={1}
      />

      {hasLeaders ? (
        <line
          {...leader(start + length)}
          className="bracket-mark__seg bracket-mark__leader"
          style={{ "--bracket-delay": "220ms" } as React.CSSProperties}
          stroke="var(--ink-faint)"
          strokeWidth={0.8}
          pathLength={1}
        />
      ) : null}

      <line
        {...farTick}
        className="bracket-mark__seg"
        style={{ "--bracket-delay": "220ms" } as React.CSSProperties}
        stroke={stroke}
        strokeWidth={strokeWidth}
        pathLength={1}
      />

      {label ? (
        <text
          className="bracket-mark__label"
          style={
            {
              fontFamily: "var(--f-serif)",
              "--bracket-delay": "330ms",
            } as React.CSSProperties
          }
          x={vertical ? spine + labelOffset : middle}
          y={vertical ? middle + labelSize * 0.32 : spine - labelOffset}
          textAnchor={vertical ? "start" : "middle"}
          fontStyle="italic"
          fontSize={labelSize}
          fill={stroke}
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}

/**
 * The monogram: the bracket compressed to a glyph — two price lines and the
 * gap between them. Survives at 16px (variant 1c).
 */
export function BracketMonogram({
  size = 18,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={`bracket-monogram ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 22 22"
      aria-hidden
      focusable="false"
    >
      <line
        x1="3"
        y1="6.5"
        x2="12"
        y2="6.5"
        className="bracket-mark__seg"
        style={{ "--bracket-delay": "0ms" } as React.CSSProperties}
        stroke="var(--ink)"
        strokeWidth={1.8}
        pathLength={1}
      />
      <line
        x1="14.5"
        y1="9.5"
        x2="19.5"
        y2="4.5"
        className="bracket-mark__seg"
        style={{ "--bracket-delay": "60ms" } as React.CSSProperties}
        stroke="var(--ink)"
        strokeWidth={1.2}
        pathLength={1}
      />
      <line
        x1="17"
        y1="7.5"
        x2="17"
        y2="14.5"
        className="bracket-mark__seg"
        style={{ "--bracket-delay": "130ms" } as React.CSSProperties}
        stroke="var(--ink)"
        strokeWidth={1.2}
        pathLength={1}
      />
      <line
        x1="3"
        y1="15.5"
        x2="12"
        y2="15.5"
        className="bracket-mark__seg"
        style={{ "--bracket-delay": "200ms" } as React.CSSProperties}
        stroke="var(--ink)"
        strokeWidth={1.8}
        pathLength={1}
      />
      <line
        x1="14.5"
        y1="17"
        x2="19.5"
        y2="12"
        className="bracket-mark__seg"
        style={{ "--bracket-delay": "200ms" } as React.CSSProperties}
        stroke="var(--ink)"
        strokeWidth={1.2}
        pathLength={1}
      />
    </svg>
  );
}
