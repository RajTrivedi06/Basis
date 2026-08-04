"use client";

/**
 * The ledger waterfall (exploration variant 1e, "ledger + depletion") — the
 * numbers-carrying view of the decomposition, and the ONE waterfall: the Basis
 * page and the landing's accounting scene render the same component.
 *
 * It starts at 100% — the price we can't explain, before accounting — and
 * subtracts one factor per row. Every factor gets a full-width row, so a 4.8%
 * line reads exactly as easily as a 61% one, and the remainder column tallies
 * down to the unfileable block in void, measured by the bracket.
 */

import { useMemo } from "react";
import {
  buildLedger,
  clamp01,
  formatShare,
  rowProgress,
  type LedgerRow,
} from "@/lib/ledger";
import type { BasisDecompositionResponse } from "@/lib/types";

export interface LedgerWaterfallProps {
  /**
   * A live decomposition response. The record arm of the union is what lets a
   * factor the API adds later arrive as a row without a change here.
   */
  decomposition: BasisDecompositionResponse | Record<string, unknown>;
  /**
   * Scroll scrub, 0–1. A bare number advances the whole ledger, one row at a
   * time, with the void block landing last; an array drives rows individually.
   * Omitted — the default — renders the finished ledger, which is what the
   * Basis page and every server render want.
   */
  progress?: number | number[];
  /** The one-line stacked bar above the ledger — the glance-glyph. */
  showGlanceGlyph?: boolean;
  /** Caption printed beside the glance-glyph, e.g. the SKU. */
  glanceLabel?: string;
  /**
   * Label on the residual terminus. Landing keeps the default "Unexplained";
   * the Basis settlement sheet passes "Unfileable".
   */
  voidLabel?: string;
  className?: string;
}

export function LedgerWaterfall({
  decomposition,
  progress,
  showGlanceGlyph = true,
  glanceLabel,
  voidLabel = "Unexplained",
  className = "",
}: LedgerWaterfallProps) {
  // Declared interfaces carry no index signature, so the response needs one
  // widening step before it can be read key-by-key.
  const ledger = useMemo(
    () => buildLedger(decomposition as Record<string, unknown>),
    [decomposition]
  );
  const { rows, residualShare } = ledger;

  // The void block is the last step, so a global scrub lands it after the
  // final factor row rather than alongside it.
  const steps = rows.length + 1;
  const voidProgress = rowProgress(progress, rows.length, steps);

  return (
    <div className={`ledger ${className}`.trim()}>
      {showGlanceGlyph ? (
        <>
          <div className="ledger__glyph" role="img" aria-label={glanceAlt(residualShare)}>
            {rows.map((row) => (
              <span
                key={row.key}
                style={{ width: `${row.share * 100}%`, background: row.color }}
              />
            ))}
            <span
              style={{
                width: `${residualShare * 100}%`,
                background: "var(--residual)",
              }}
            />
          </div>
          <div className="ledger__glyph-caption">
            <span>Share of price variation{glanceLabel ? ` · ${glanceLabel}` : ""}</span>
            <span>Live</span>
          </div>
        </>
      ) : null}

      <div className="ledger__opening">
        <span className="ledger__opening-label">
          The price we can&apos;t explain, before accounting
        </span>
        <span className="ledger__opening-value">100.0%</span>
      </div>

      {rows.map((row, index) => (
        <LedgerRowView
          key={row.key}
          row={row}
          progress={rowProgress(progress, index, steps)}
        />
      ))}

      <div
        className="ledger__void"
        style={{ opacity: stamp(voidProgress) }}
        aria-hidden={voidProgress === 0}
      >
        <span className="ledger__void-key">
          <span className="ledger__op">=</span>
          <span className="ledger__void-tag">{voidLabel}</span>
        </span>
        <span className="ledger__void-value">
          {formatShare(residualShare)}%
        </span>
      </div>

      {/* The bracket measures the remainder. Fluid-width form of the mark:
          a rule with a 45° tick at each end, in void because the thing being
          measured IS the unexplained share (ADR-0005). */}
      <div
        className="ledger__measure"
        style={{
          width: `${residualShare * 100}%`,
          opacity: stamp(voidProgress),
        }}
        aria-hidden
      />
      <div className="ledger__measure-caption" style={{ opacity: stamp(voidProgress) }}>
        {formatShare(residualShare)} of every 100 · unaccounted
      </div>
    </div>
  );
}

function LedgerRowView({
  row,
  progress,
}: {
  row: LedgerRow;
  progress: number;
}) {
  // The slice grows out of the remainder: sand shrinks by exactly what the
  // factor slice takes, so the row shows the subtraction being performed.
  const taken = row.share * progress;
  const left = row.before - taken;

  return (
    <div className="ledger__row" style={{ opacity: stamp(progress) }}>
      <div className="ledger__line">
        <span className="ledger__op">−</span>
        <span className="ledger__name">
          {row.phrase ? (
            <>
              {row.phrase} · <span className="ledger__tag">{row.tag}</span>
            </>
          ) : (
            <span className="ledger__tag">{row.tag}</span>
          )}
        </span>
        <span className="ledger__share">{formatShare(row.share)}%</span>
        <span className="ledger__left">{formatShare(left)} left</span>
      </div>
      <div className="ledger__depletion">
        <span
          className="ledger__depletion-sand"
          style={{ width: `${left * 100}%` }}
        />
        <span
          className="ledger__depletion-slice"
          style={{ width: `${taken * 100}%`, background: row.color }}
        />
      </div>
    </div>
  );
}

/** Rows stamp rather than fade — full opacity within the first quarter turn. */
function stamp(progress: number): number {
  return clamp01(progress * 4);
}

function glanceAlt(residualShare: number): string {
  return `Share of price variation, with ${formatShare(
    residualShare
  )}% unexplained`;
}
