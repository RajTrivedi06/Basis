/**
 * Residual-first horizontal stacked variance-decomposition bar.
 *
 * Segment order is MODEL ORDER: region → commitment → provider → bundle → residual.
 * Matches backend sequential ANOVA in backend/basis/analytics/basis.py; this is
 * NOT the prototype order. Order matters because sequential ANOVA is
 * order-dependent — factor shares shift with reordering — while the residual
 * share is invariant. Keeping bar order aligned with model order is what makes
 * the "cumulative %" framing honest against the Methodology narrative.
 */

import { factorColor, type Factor } from "@/lib/factorColor";

export interface DecompShares {
  provider: number;
  commitment: number;
  region: number;
  bundle: number;
  residual: number;
}

interface DecompBarProps {
  decomp: DecompShares;
  height?: number;
  showLabels?: boolean;
}

const SEGMENTS: { key: Factor; label: string }[] = [
  { key: "region", label: "Region" },
  { key: "commitment", label: "Commitment" },
  { key: "provider", label: "Provider" },
  { key: "bundle", label: "Bundle" },
];

export function DecompBar({
  decomp,
  height = 72,
  showLabels = true,
}: DecompBarProps) {
  const factors = SEGMENTS.map((s) => ({ ...s, v: decomp[s.key] }));
  const residual = decomp.residual;
  const total = factors.reduce((s, f) => s + f.v, 0) + residual;

  return (
    <div>
      {showLabels && (
        <div className="mb-2.5 flex items-center justify-between">
          <span className="eyebrow">Explained</span>
          <span className="eyebrow" style={{ color: "var(--residual)" }}>
            Residual · {(residual * 100).toFixed(1)}%
          </span>
        </div>
      )}
      <div
        className="flex overflow-hidden"
        style={{
          height,
          borderRadius: 2,
          border: "1px solid var(--line)",
        }}
        role="img"
        aria-label={`Variance decomposition: residual ${(residual * 100).toFixed(
          1
        )}% unexplained`}
      >
        {factors.map((f) => {
          const share = f.v / total;
          return (
            <div
              key={f.key}
              style={{
                width: `${share * 100}%`,
                background: factorColor(f.key),
                borderRight: "1px solid rgba(0,0,0,0.25)",
                position: "relative",
                overflow: "hidden",
              }}
              title={`${f.label}: ${(f.v * 100).toFixed(1)}%`}
            >
              {share > 0.08 && (
                <div
                  className="absolute inset-0 flex flex-col justify-between"
                  style={{ padding: "8px 10px" }}
                >
                  <span
                    className="mono"
                    style={{
                      fontSize: 10,
                      color: "rgba(255,255,255,0.95)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}
                  >
                    {f.label}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,0.95)",
                    }}
                  >
                    {(f.v * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          );
        })}
        <div
          style={{
            width: `${(residual / total) * 100}%`,
            background: "var(--residual)",
            position: "relative",
            overflow: "hidden",
          }}
          title={`Residual: ${(residual * 100).toFixed(1)}%`}
        >
          <div
            className="absolute inset-0 flex flex-col justify-between"
            style={{ padding: "10px 14px" }}
          >
            <span
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--bg-deep)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              Residual · unexplained
            </span>
            <span
              className="mono"
              style={{
                fontSize: 22,
                color: "var(--bg-deep)",
                fontWeight: 700,
              }}
            >
              {(residual * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
      {showLabels && (
        <div className="mt-3 flex flex-wrap gap-4">
          {factors.map((f) => (
            <div key={f.key} className="flex items-center gap-2">
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 1,
                  background: factorColor(f.key),
                }}
              />
              <span className="caption">{f.label}</span>
              <span
                className="mono"
                style={{ fontSize: 11, color: "var(--ink)" }}
              >
                {(f.v * 100).toFixed(1)}%
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 1,
                background: "var(--residual)",
              }}
            />
            <span className="caption" style={{ color: "var(--residual)" }}>
              Residual
            </span>
            <span
              className="mono"
              style={{ fontSize: 11, color: "var(--residual)" }}
            >
              {(residual * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
