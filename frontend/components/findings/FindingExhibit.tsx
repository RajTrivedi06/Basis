"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  ERA_ANNOTATIONS,
  annotationIndex,
} from "@/components/charts/eraAnnotations";

/** One day of the record: the real residual share the API returned. */
export interface ExhibitPoint {
  date: string;
  pct: number;
}

const VB_W = 506;
const VB_H = 86;
const TOP = 4;
const BOT = 66;

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
 * Pointer or keyboard scrubs a day, click/Enter pins the reading, the era
 * flags jump to their event. Renders the series' real jaggedness: the
 * polyline is a straight-segment path, never smoothed.
 */
export function FindingExhibit({ points }: { points: ExhibitPoint[] }) {
  const [idx, setIdx] = useState<number | null>(null);
  const [pinned, setPinned] = useState(false);
  const plotRef = useRef<HTMLDivElement | null>(null);

  const geo = useMemo(() => {
    const values = points.map((p) => p.pct);
    const lo = Math.max(0, Math.floor(Math.min(...values) - 6));
    const hi = Math.min(100, Math.ceil(Math.max(...values) + 6));
    const span = hi - lo || 1;
    const n = points.length;
    const x = (i: number) => (n <= 1 ? 0 : (i * VB_W) / (n - 1));
    const y = (pct: number) => BOT - ((pct - lo) / span) * (BOT - TOP);
    // Two readable gridlines inside the domain, on tens.
    const lines = [10, 20, 30, 40, 50, 60, 70, 80, 90].filter(
      (v) => v > lo + 3 && v < hi - 3
    );
    const mid = lines.length
      ? [lines[0], lines[lines.length - 1]].filter(
          (v, i, arr) => arr.indexOf(v) === i
        )
      : [];
    return {
      lo,
      hi,
      x,
      y,
      grid: mid,
      path: points.map((p, i) => `${x(i).toFixed(1)},${y(p.pct).toFixed(1)}`).join(" "),
    };
  }, [points]);

  const flags = useMemo(() => {
    const dates = points.map((p) => p.date);
    return ERA_ANNOTATIONS.map((a) => ({
      annotation: a,
      index: annotationIndex(dates, a),
    })).filter((f): f is { annotation: (typeof ERA_ANNOTATIONS)[number]; index: number } =>
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

  const onPointerMove = (e: React.PointerEvent) => {
    if (pinned) return;
    scrub(e.clientX);
  };
  const onPointerLeave = () => {
    if (!pinned) setIdx(null);
  };
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
        <span>EXHIBIT — DAILY RECORD</span>
        <span
          className="memo-exhibit__readout"
          data-pinned={pinned ? "true" : undefined}
          aria-live="polite"
        >
          {readout}
        </span>
      </div>

      <div
        ref={plotRef}
        className="memo-exhibit__plot"
        role="application"
        tabIndex={0}
        aria-label={`Daily unexplained share, ${points.length} days ending ${
          last ? shortDate(last.date) : "—"
        }. Arrow keys scrub, Enter pins a reading.`}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onPointerDown={(e) => {
          scrub(e.clientX);
        }}
        onClick={togglePin}
        onKeyDown={onKeyDown}
      >
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="none"
          className="memo-exhibit__svg"
          aria-hidden="true"
          focusable="false"
        >
          {geo.grid.map((v) => (
            <line
              key={v}
              x1={0}
              x2={VB_W}
              y1={geo.y(v)}
              y2={geo.y(v)}
              stroke="var(--memo-rule-soft)"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {flags.map((f) => (
            <line
              key={f.annotation.date}
              x1={geo.x(f.index)}
              x2={geo.x(f.index)}
              y1={TOP}
              y2={BOT}
              stroke="var(--memo-ink-mid)"
              strokeDasharray="3,3"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <polyline
            className="memo-exhibit__line"
            points={geo.path}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />

          {idx !== null && (
            <line
              x1={geo.x(idx)}
              x2={geo.x(idx)}
              y1={TOP}
              y2={BOT}
              stroke="var(--ink)"
              strokeWidth={0.8}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* Dots live in HTML: the viewBox is stretched to fill the width,
            which would turn SVG circles into ellipses. */}
        {geo.grid.map((v) => (
          <span
            key={v}
            className="memo-exhibit__gridlabel"
            style={{ top: `${(geo.y(v) / VB_H) * 100}%` }}
          >
            {v}%
          </span>
        ))}
        {last && (
          <span
            className="memo-exhibit__dot"
            style={{
              left: `${(geo.x(points.length - 1) / VB_W) * 100}%`,
              top: `${(geo.y(last.pct) / VB_H) * 100}%`,
            }}
          />
        )}
        {active !== null && idx !== null && (
          <span
            className="memo-exhibit__dot memo-exhibit__dot--cursor"
            data-pinned={pinned ? "true" : undefined}
            style={{
              left: `${(geo.x(idx) / VB_W) * 100}%`,
              top: `${(geo.y(active.pct) / VB_H) * 100}%`,
            }}
          />
        )}

        <div className="memo-exhibit__axis">
          <span>{points[0] ? shortDate(points[0].date) : "—"}</span>
          <span>
            {last ? `${shortDate(last.date)} · ${last.pct.toFixed(1)}%` : "—"}
          </span>
        </div>
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
              ⌖ {shortDate(f.annotation.date)} {f.annotation.marker === "D" ? "ERA D" : "CATALOGS JOIN"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
