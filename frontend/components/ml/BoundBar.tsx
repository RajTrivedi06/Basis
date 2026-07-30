/**
 * Residual-first bound bar: 4-factor ANOVA explained share vs GBM holdout R².
 *
 * Amber is reserved for unexplained variance after the observable-features bound.
 * The GBM incremental segment shrinks the amber region — not a generic two-number bar.
 */

interface BoundBarProps {
  anovaExplained: number;
  gbmR2: number;
  gap: number;
  height?: number;
}

const ANOVA_COLOR = "var(--factor-provider)";
const GAP_COLOR = "var(--verdict-ok)";

function clampShare(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function BoundBar({
  anovaExplained,
  gbmR2,
  gap,
  height = 88,
}: BoundBarProps) {
  const anova = clampShare(anovaExplained);
  const gbm = clampShare(gbmR2);
  const gapShare = clampShare(gap);
  const unexplained = clampShare(1 - gbm);

  const segments = [
    {
      key: "anova",
      label: "4-factor ANOVA",
      share: anova,
      color: ANOVA_COLOR,
      pct: anova * 100,
    },
    {
      key: "gap",
      label: "Richer features (gap)",
      share: gapShare,
      color: GAP_COLOR,
      pct: gapShare * 100,
    },
    {
      key: "unexplained",
      label: "Unexplained after bound",
      share: unexplained,
      color: "var(--residual)",
      pct: unexplained * 100,
      isResidual: true,
    },
  ].filter((s) => s.share > 0);

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="eyebrow">Observable-features bound</span>
        <span className="eyebrow" style={{ color: "var(--residual)" }}>
          Residual · {(unexplained * 100).toFixed(1)}%
        </span>
      </div>

      <div
        className="flex overflow-hidden"
        style={{
          height,
          borderRadius: 2,
          border: "1px solid var(--line)",
        }}
        role="img"
        aria-label={`Bound bar: GBM holdout R² ${(gbm * 100).toFixed(
          1
        )}%, ANOVA explained ${(anova * 100).toFixed(1)}%, gap ${(
          gapShare * 100
        ).toFixed(1)}%, unexplained ${(unexplained * 100).toFixed(1)}%`}
      >
        {segments.map((segment) => (
          <div
            key={segment.key}
            style={{
              width: `${segment.share * 100}%`,
              background: segment.color,
              borderRight:
                segment.key !== "unexplained"
                  ? "1px solid rgba(0,0,0,0.25)"
                  : undefined,
              position: "relative",
              overflow: "hidden",
            }}
            title={`${segment.label}: ${segment.pct.toFixed(1)}%`}
          >
            {segment.share > 0.12 && (
              <div
                className="absolute inset-0 flex flex-col justify-between"
                style={{ padding: segment.isResidual ? "10px 14px" : "8px 10px" }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: segment.isResidual ? 11 : 10,
                    color: segment.isResidual
                      ? "var(--bg-deep)"
                      : "rgba(255,255,255,0.95)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    fontWeight: segment.isResidual ? 700 : 400,
                  }}
                >
                  {segment.label}
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: segment.isResidual ? 22 : 13,
                    color: segment.isResidual
                      ? "var(--bg-deep)"
                      : "rgba(255,255,255,0.95)",
                    fontWeight: segment.isResidual ? 700 : 400,
                  }}
                >
                  {segment.pct.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <BoundStat
          label="GBM holdout R²"
          value={`${(gbm * 100).toFixed(1)}%`}
          detail="out-of-sample on held-out days"
        />
        <BoundStat
          label="ANOVA explained (same days)"
          value={`${(anova * 100).toFixed(1)}%`}
          detail="sequential 4-factor share"
        />
        <BoundStat
          label="Gap"
          value={`${(gapShare * 100).toFixed(1)} pp`}
          detail="richer features beyond ANOVA"
          accent
        />
      </div>
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
