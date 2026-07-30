/**
 * SHAP top-features chart — hand-rolled SVG per ADR-0005 (no chart library).
 */

import type { ShapTopFeature } from "@/lib/mlExplainabilityTypes";

interface ShapFeaturesChartProps {
  features: ShapTopFeature[];
  maxFeatures?: number;
  width?: number;
  rowHeight?: number;
}

export function ShapFeaturesChart({
  features,
  maxFeatures = 20,
  width = 520,
  rowHeight = 28,
}: ShapFeaturesChartProps) {
  const rows = features.slice(0, maxFeatures);
  const labelWidth = 148;
  const barAreaWidth = width - labelWidth - 48;
  const maxShap =
    rows.length > 0
      ? Math.max(...rows.map((f) => f.mean_abs_shap), 0.0001)
      : 1;
  const height = Math.max(rows.length * rowHeight, rowHeight);

  if (rows.length === 0) {
    return (
      <p className="caption text-[var(--ink-dim)]">
        No SHAP features in this artifact.
      </p>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`SHAP top ${rows.length} features by mean absolute SHAP`}
      className="max-w-full"
    >
      {rows.map((feature, index) => {
        const y = index * rowHeight;
        const barWidth = (feature.mean_abs_shap / maxShap) * barAreaWidth;

        return (
          <g key={`${feature.rank}-${feature.feature}`}>
            <text
              x={0}
              y={y + rowHeight / 2}
              fill="var(--ink-mid)"
              fontSize={11}
              fontFamily="var(--f-mono)"
              dominantBaseline="middle"
            >
              {feature.feature}
            </text>
            <rect
              x={labelWidth}
              y={y + 6}
              width={barWidth}
              height={rowHeight - 12}
              fill="var(--factor-provider)"
              rx={1}
            />
            <text
              x={labelWidth + barWidth + 8}
              y={y + rowHeight / 2}
              fill="var(--ink)"
              fontSize={11}
              fontFamily="var(--f-mono)"
              dominantBaseline="middle"
            >
              {feature.mean_abs_shap.toFixed(3)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
