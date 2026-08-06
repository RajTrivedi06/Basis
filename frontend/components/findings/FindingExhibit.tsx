"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ERA_ANNOTATIONS,
  annotationIndex,
} from "@/components/charts/eraAnnotations";

/** One day of the record: the real residual share the API returned. */
export interface ExhibitPoint {
  date: string;
  pct: number;
}

/**
 * Plot height in CSS pixels. The width is measured, never assumed — the
 * viewBox matches the rendered box 1:1 so nothing is ever stretched.
 */
const H = 118;
const H_COMPACT = 96;
const TOP = 10;
const PAD_BOTTOM = 22;

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d
    .toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })
    .toUpperCase();
}

/**
 * The daily record — a live instrument, not a picture (design 4a).
 *
 * Geometry is computed in measured pixels rather than a stretched viewBox:
 * a forced aspect ratio made the line look elongated on wide cards and
 * squeezed on narrow ones, and turned dots into ellipses.
 */
export function FindingExhibit({
  points,
  compact = false,
}: {
  points: ExhibitPoint[];
  compact?: boolean;
}) {
  const [idx, setIdx] = useState<number | null>(null);
  const [pinned, setPinned] = useState(false);
  const [width, setWidth] = useState(0);
  const plotRef = useRef<HTMLDivElement | null>(null);

  const height = compact ? H_COMPACT : H;

  useEffect(() => {
    const el = plotRef.current;
    if (el === null) return;
    setWidth(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth((cur) => (Math.abs(cur - w) < 0.5 ? cur : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    const w = width > 0 ? width : 520;
    const bottom = height - PAD_BOTTOM;
    const values = points.map((p) => p.pct);
    const lo = values.length ? Math.max(0, Math.floor(Math.min(...values) - 6)) : 0;
    const hi = values.length ? Math.min(100, Math.ceil(Math.max(...values) + 6)) : 100;
    const span = hi - lo || 1;
    const n = points.length;
    const x = (i: number) => (n <= 1 ? 0 : (i * w) / (n - 1));
    const y = (pct: number) => bottom - ((pct - lo) / span) * (bottom - TOP);
    const grid = [10, 20, 30, 40, 50, 60, 70, 80, 90].filter(
      (v) => v > lo + 4 && v < hi - 4
    );
    return {
      w,
      bottom,
      x,
      y,
      grid: grid.length > 2 ? [grid[0], grid[Math.floor(grid.length / 2)], grid[grid.length - 1]] : grid,
      path: points
        .map((p, i) => `${x(i).toFixed(1)},${y(p.pct).toFixed(1)}`)
        .join(" "),
    };
  }, [points, width, height]);

  const flags = useMemo(() => {
    const dates = points.map((p) => p.date);
    return ERA_ANNOTATIONS.map((a) => ({
      annotation: a,
      index: annotationIndex(dates, a),
    })).filter(
      (f): f is { annotation: (typeof ERA_ANNOTATIONS)[number]; index: number } =>
        f.index !== null
    );
  }, [points]);

  const scrub = useCallback(
    (clientX: number) => {
      const el = plotRef.current;
      if (el === null || points.length === 0) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0) return;
      const raw = ((clientX - r.left) / r.width) * (points.length - 1);
      const next = Math.max(0, Math.min(points.length - 1, Math.round(raw)));
      setIdx((cur) => (cur === next ? cur : next));
    },
    [points.length]
  );

  const togglePin = () => {
    if (idx === null) return;
    setPinned((p) => !p);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (points.length === 0) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const step = e.key === "ArrowRight" ? 1 : -1;
      setIdx((cur) => {
        const base = cur === null ? points.length - 1 : cur;
        return Math.max(0, Math.min(points.length - 1, base + step));
      });
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      togglePin();
    } else if (e.key === "Escape") {
      setPinned(false);
      setIdx(null);
    }
  };

  const active = idx === null ? null : points[idx];
  const readout =
    active === null
      ? "SCRUB THE RECORD →"
      : `${pinned ? "PINNED" : "READING"} ${shortDate(active.date)} · ${active.pct.toFixed(1)}% UNEXPLAINED`;
  const last = points[points.length - 1];

  return (
    <div className="memo-exhibit">
      <div className="memo-exhibit__head">
        <span>EXHIBIT: DAILY RECORD</span>
        <span
          className="memo-exhibit__readout"
          data-pinned={pinned ? "true" : undefined}
          aria-live="polite"
        >
          {readout}
        </span>
      </div>

      {/* The declassification swipe: a shutter wipes left→right on reveal. */}
      <div className="memo-exhibit__frame" data-swipe>
        <div
          ref={plotRef}
          className="memo-exhibit__plot"
          style={{ height }}
          role="application"
          tabIndex={0}
          aria-label={`Daily unexplained share, ${points.length} days ending ${
            last ? shortDate(last.date) : "-"
          }. Arrow keys scrub, Enter pins a reading.`}
          onPointerMove={(e) => {
            if (!pinned) scrub(e.clientX);
          }}
          onPointerLeave={() => {
            if (!pinned) setIdx(null);
          }}
          onPointerDown={(e) => scrub(e.clientX)}
          onClick={togglePin}
          onKeyDown={onKeyDown}
        >
          <svg
            className="memo-exhibit__svg"
            width={geo.w}
            height={height}
            viewBox={`0 0 ${geo.w} ${height}`}
            aria-hidden="true"
            focusable="false"
          >
            {geo.grid.map((v) => (
              <g key={v}>
                <line
                  x1={0}
                  x2={geo.w}
                  y1={geo.y(v)}
                  y2={geo.y(v)}
                  stroke="var(--memo-rule-soft)"
                  strokeDasharray="1 3"
                />
                <text x={2} y={geo.y(v) - 4} className="memo-exhibit__gridlabel">
                  {v}%
                </text>
              </g>
            ))}

            {flags.map((f) => (
              <line
                key={f.annotation.date}
                x1={geo.x(f.index)}
                x2={geo.x(f.index)}
                y1={TOP - 4}
                y2={geo.bottom}
                stroke="var(--memo-ink-mid)"
                strokeDasharray="3,3"
              />
            ))}

            <polyline
              className="memo-exhibit__line"
              points={geo.path}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={1.6}
              strokeLinejoin="round"
            />

            {idx !== null && active !== null && (
              <g>
                <line
                  x1={geo.x(idx)}
                  x2={geo.x(idx)}
                  y1={TOP - 4}
                  y2={geo.bottom}
                  stroke="var(--ink)"
                  strokeWidth={0.9}
                />
                <circle
                  cx={geo.x(idx)}
                  cy={geo.y(active.pct)}
                  r={3.5}
                  fill={pinned ? "var(--residual)" : "var(--accent)"}
                  stroke="var(--memo-paper)"
                  strokeWidth={1.6}
                />
              </g>
            )}

            {last && (
              <circle
                cx={geo.x(points.length - 1)}
                cy={geo.y(last.pct)}
                r={2.6}
                fill="var(--accent)"
                stroke="var(--memo-paper)"
                strokeWidth={1.5}
              />
            )}

            <text x={0} y={height - 6} className="memo-exhibit__axislabel">
              {points[0] ? shortDate(points[0].date) : "-"}
            </text>
            <text
              x={geo.w}
              y={height - 6}
              textAnchor="end"
              className="memo-exhibit__axislabel"
            >
              {last ? `${shortDate(last.date)} · ${last.pct.toFixed(1)}%` : "-"}
            </text>
          </svg>
        </div>
        <span className="memo-exhibit__shutter" aria-hidden="true" />
      </div>

      {flags.length > 0 && (
        <div className="memo-exhibit__flags">
          {flags.map((f) => (
            <button
              key={f.annotation.date}
              type="button"
              className="memo-flag"
              data-active={idx === f.index ? "true" : undefined}
              onClick={(e) => {
                e.stopPropagation();
                setIdx(f.index);
                setPinned(true);
              }}
            >
              ⌖ {shortDate(f.annotation.date)}{" "}
              {f.annotation.marker === "D" ? "ERA D" : "CATALOGS JOIN"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
