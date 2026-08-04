/**
 * Compact declassified bound strip for Exhibit I (design 5b).
 * Hatched in-sample claim, void unexplained remainder, terracotta OOS marker.
 */

interface BoundStripProps {
  anovaExplained: number;
  gbmR2: number;
  gap: number;
}

function clampShare(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatGapPp(gap: number): string {
  const pp = gap * 100;
  if (!Number.isFinite(pp)) return "0.0 pp";
  const sign = pp < 0 ? "−" : "+";
  return `${sign}${Math.abs(pp).toFixed(1)} pp`;
}

export function BoundStrip({ anovaExplained, gbmR2, gap }: BoundStripProps) {
  const isNegativeGap = gap < 0;
  const anovaShare = clampShare(anovaExplained);
  const gbmShare = clampShare(gbmR2);
  const unexplainedShare = isNegativeGap
    ? clampShare(1 - anovaExplained)
    : clampShare(1 - gbmR2);

  const ariaLabel = isNegativeGap
    ? `Bound bar: GBM holdout R² ${formatPct(gbmR2)}, ANOVA explained ${formatPct(
        anovaExplained
      )}, gap ${formatGapPp(gap)}, unexplained ${formatPct(unexplainedShare)}`
    : `Bound bar: GBM holdout R² ${formatPct(gbmR2)}, ANOVA explained ${formatPct(
        anovaExplained
      )}, gap ${formatGapPp(gap)}, unexplained ${formatPct(unexplainedShare)}`;

  return (
    <div className="bound-strip">
      <div className="bound-strip__row">
        <div className="bound-strip__track-wrap">
          <div
            className="bound-strip__track"
            role="img"
            aria-label={ariaLabel}
          >
            <div
              data-testid="bound-bar-segment"
              className="bound-strip__claim"
              style={{ width: `${anovaShare * 100}%` }}
              title={`4-factor claim: ${formatPct(anovaExplained)}`}
            />
            <div
              data-testid="bound-bar-segment"
              className="bound-strip__void"
              style={{ width: `${unexplainedShare * 100}%` }}
              title={`Unexplained after bound: ${formatPct(unexplainedShare)}`}
            />
            <span
              data-testid="gbm-bound-marker"
              className="bound-strip__marker"
              style={{ left: `${gbmShare * 100}%` }}
              title={`Out-of-sample bound: ${formatPct(gbmR2)}`}
              aria-hidden
            />
          </div>
          <div className="bound-strip__labels">
            <span style={{ width: `${anovaShare * 100}%` }}>4-FACTOR CLAIM</span>
            <span
              style={{ width: `${unexplainedShare * 100}%` }}
              className="bound-strip__labels-right"
            >
              UNEXPLAINED AFTER BOUND
            </span>
          </div>
        </div>
        <div className="bound-strip__residual">
          <div className="bound-strip__residual-label">RESIDUAL</div>
          <div className="bound-strip__residual-value">
            {formatPct(unexplainedShare)}
          </div>
        </div>
      </div>
    </div>
  );
}

export { formatPct, formatGapPp };
