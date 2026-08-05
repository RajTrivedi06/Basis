/**
 * Compact residual-share sparkline for the findings attachment sheet.
 * Hand-built SVG — no chart library.
 */
export function ResidualSparkline({
  values,
  width = 220,
  height = 40,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;
  const plotH = height - pad * 2;

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = pad + plotH - ((value - min) / span) * plotH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const label = `${values.length}-day residual share from ${min.toFixed(
    0
  )}% to ${max.toFixed(0)}%`;

  return (
    <figure className="fc-spark" aria-label={label}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        aria-hidden
      >
        <polyline
          points={points}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </figure>
  );
}
