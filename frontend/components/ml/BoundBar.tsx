/**
 * Residual-first bound bar: 4-factor ANOVA explained share vs GBM holdout R².
 *
 * Amber is reserved for unexplained variance after the observable-features bound.
 * When gap < 0, the GBM bound sits below the ANOVA share — shown as a marker
 * inside the ANOVA segment, not a green gain segment.
 */

interface BoundBarProps {
  anovaExplained: number;
  gbmR2: number;
  gap: number;
  height?: number;
}

const ANOVA_COLOR = "var(--factor-provider)";
const GAP_COLOR = "var(--verdict-ok)";
const MARKER_COLOR = "var(--ink-dim)";

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
  const sign = pp < 0 ? "−" : "";
  return `${sign}${Math.abs(pp).toFixed(1)} pp`;
}

export function BoundBar({
  anovaExplained,
  gbmR2,
  gap,
  height = 88,
}: BoundBarProps) {
  const isNegativeGap = gap < 0;
  const anovaShare = clampShare(anovaExplained);
  const gbmShare = clampShare(gbmR2);
  const gapShare = gap >= 0 ? clampShare(gap) : 0;
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
    <div>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="eyebrow">Observable-features bound</span>
        <span className="eyebrow" style={{ color: "var(--residual)" }}>
          Residual · {(unexplainedShare * 100).toFixed(1)}%
        </span>
      </div>

      <div
        className="relative flex overflow-hidden"
        style={{
          height,
          borderRadius: 2,
          border: "1px solid var(--line)",
        }}
        role="img"
        aria-label={ariaLabel}
      >
        {isNegativeGap ? (
          <>
            <BarSegment
              label="4-factor ANOVA"
              share={anovaShare}
              color={ANOVA_COLOR}
              isResidual={false}
            />
            <BarSegment
              label="Unexplained after bound"
              share={unexplainedShare}
              color="var(--residual)"
              isResidual
            />
            <div
              data-testid="gbm-bound-marker"
              className="pointer-events-none absolute bottom-0 top-0 z-10"
              style={{
                left: `${gbmShare * 100}%`,
                width: 2,
                transform: "translateX(-50%)",
                background: MARKER_COLOR,
                boxShadow: "0 0 0 1px rgba(0,0,0,0.35)",
              }}
              title={`Out-of-sample bound: ${formatPct(gbmR2)}`}
              aria-hidden
            />
          </>
        ) : (
          [
            {
              key: "anova",
              label: "4-factor ANOVA",
              share: anovaShare,
              color: ANOVA_COLOR,
              isResidual: false,
            },
            {
              key: "gap",
              label: "Richer features (gap)",
              share: gapShare,
              color: GAP_COLOR,
              isResidual: false,
            },
            {
              key: "unexplained",
              label: "Unexplained after bound",
              share: unexplainedShare,
              color: "var(--residual)",
              isResidual: true,
            },
          ]
            .filter((segment) => segment.share > 0)
            .map((segment) => (
              <BarSegment
                key={segment.key}
                label={segment.label}
                share={segment.share}
                color={segment.color}
                isResidual={segment.isResidual}
              />
            ))
        )}
      </div>

      {isNegativeGap ? (
        <p className="caption mt-3 text-[var(--ink-mid)]">
          Out-of-sample bound ({formatPct(gbmR2)}) sits below the in-sample 4-factor
          share ({formatPct(anovaExplained)})
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <BoundStat
          label="GBM holdout R²"
          value={formatPct(gbmR2)}
          detail="out-of-sample on held-out days"
        />
        <BoundStat
          label="ANOVA explained (same days)"
          value={formatPct(anovaExplained)}
          detail="sequential 4-factor share"
        />
        <BoundStat
          label="Gap"
          value={formatGapPp(gap)}
          detail="richer features beyond ANOVA"
          accent={gap > 0}
        />
      </div>
    </div>
  );
}

function BarSegment({
  label,
  share,
  color,
  isResidual,
}: {
  label: string;
  share: number;
  color: string;
  isResidual: boolean;
}) {
  const pct = share * 100;

  return (
    <div
      data-testid="bound-bar-segment"
      style={{
        width: `${share * 100}%`,
        background: color,
        borderRight: !isResidual ? "1px solid rgba(0,0,0,0.25)" : undefined,
        position: "relative",
        overflow: "hidden",
      }}
      title={`${label}: ${pct.toFixed(1)}%`}
    >
      {share > 0.12 && (
        <div
          className="absolute inset-0 flex flex-col justify-between"
          style={{ padding: isResidual ? "10px 14px" : "8px 10px" }}
        >
          <span
            className="mono"
            style={{
              fontSize: isResidual ? 11 : 10,
              color: isResidual ? "var(--bg-deep)" : "rgba(255,255,255,0.95)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: isResidual ? 700 : 400,
            }}
          >
            {label}
          </span>
          <span
            className="mono"
            style={{
              fontSize: isResidual ? 22 : 13,
              color: isResidual ? "var(--bg-deep)" : "rgba(255,255,255,0.95)",
              fontWeight: isResidual ? 700 : 400,
            }}
          >
            {pct.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}

function BoundStat({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--panel-lo)] px-3 py-2.5">
      <div className="caption">{label}</div>
      <div
        className="mono mt-1 text-lg font-medium"
        style={{ color: accent ? "var(--verdict-ok)" : "var(--ink-hi)" }}
      >
        {value}
      </div>
      <div className="caption mt-1 text-[var(--ink-dim)]">{detail}</div>
    </div>
  );
}
