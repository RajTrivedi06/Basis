"use client";

export type DispersionFanPoint = {
  date: string;
  p25: number;
  median: number;
  p75: number;
};

type DispersionFanProps = {
  data: DispersionFanPoint[];
  height?: number;
  title: string;
};

/**
 * Hand-rolled SVG: p25–p75 band + median.
 *
 * Color grammar (ADR-0005 as amended 2026-08-03): the median is a single-series
 * line mark, so it takes the accent; the band and axes stay ink. Nothing here
 * encodes a residual share, so void appears nowhere in this chart.
 */
export function DispersionFan({
  data,
  height = 380,
  title,
}: DispersionFanProps) {
  if (!data.length) return null;

  const W = 1000;
  const H = height;
  const padL = 52;
  const padR = 20;
  const padT = 20;
  const padB = 42;
  const iW = W - padL - padR;
  const iH = H - padT - padB;
  const n = data.length;

  const all = data.flatMap((d) => [d.p25, d.median, d.p75]);
  const yMinRaw = Math.min(...all);
  const yMaxRaw = Math.max(...all);
  const span = yMaxRaw - yMinRaw || Math.abs(yMinRaw) * 0.02 || 0.01;
  const padY = span * 0.06;
  const lo = yMinRaw - padY;
  const hi = yMaxRaw + padY;

  const xAt = (i: number) =>
    padL + (n <= 1 ? iW / 2 : (i / (n - 1)) * iW);
  const yAt = (v: number) =>
    padT + (1 - (v - lo) / (hi - lo || 1)) * iH;

  /* Single day: no polyline path; draw IQR band as a bar + median stroke. */
  if (n === 1) {
    const d = data[0];
    const xm = padL + iW / 2;
    const bw = Math.min(iW * 0.24, 120);
    const xl = xm - bw / 2;
    const xr = xm + bw / 2;
    const y25 = yAt(d.p25);
    const y75 = yAt(d.p75);
    const ym = yAt(d.median);
    const top = Math.min(y25, y75);
    const hBar = Math.max(Math.abs(y25 - y75), 2);

    const tickCount = 5;
    const yTicks = Array.from({ length: tickCount + 1 }, (_, k) => {
      const t = lo + (k / tickCount) * (hi - lo);
      return { k, v: t, y: yAt(t) };
    });

    return (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        height={H}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        className="block max-w-full"
        role="img"
      >
        <title>{title}</title>
        {yTicks.map(({ k, v, y }) => (
          <g key={k}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y}
              y2={y}
              stroke="var(--line-lo)"
              strokeDasharray={k === 0 ? "0" : "2 4"}
            />
            <text
              x={padL - 8}
              y={y + 3}
              textAnchor="end"
              fontSize="10"
              fontFamily="var(--f-mono)"
              fill="var(--ink-dim)"
            >
              {`$${v.toFixed(2)}`}
            </text>
          </g>
        ))}
        <rect
          x={xl}
          y={top}
          width={xr - xl}
          height={hBar}
          fill="var(--ink-mid)"
          fillOpacity={0.14}
          rx={2}
        />
        <line
          x1={xl}
          x2={xr}
          y1={ym}
          y2={ym}
          stroke="var(--accent)"
          strokeWidth={1.5}
        />
        <text
          x={xm}
          y={H - padB + 16}
          fontSize="10"
          fontFamily="var(--f-mono)"
          fill="var(--ink-dim)"
          textAnchor="middle"
        >
          {d.date.slice(5)}
        </text>
      </svg>
    );
  }

  const bandPath = (() => {
    const up = data.map(
      (d, i) => `${i ? "L" : "M"}${xAt(i).toFixed(1)} ${yAt(d.p75).toFixed(1)}`
    );
    const dn = data
      .slice()
      .reverse()
      .map(
        (d, i) =>
          `L${xAt(n - 1 - i).toFixed(1)} ${yAt(d.p25).toFixed(1)}`
      );
    return [...up, ...dn, "Z"].join(" ");
  })();

  const medPath = data
    .map(
      (d, i) =>
        `${i ? "L" : "M"}${xAt(i).toFixed(1)} ${yAt(d.median).toFixed(1)}`
    )
    .join(" ");

  const tickCount = 5;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, k) => {
    const t = lo + (k / tickCount) * (hi - lo);
    return { k, v: t, y: yAt(t) };
  });

  const xLabelIdx = [
    0,
    Math.floor(n * 0.25),
    Math.floor(n * 0.5),
    Math.floor(n * 0.75),
    n - 1,
  ].filter((i, pos, arr) => arr.indexOf(i) === pos);

  const fmtUsd = (v: number) => `$${v.toFixed(2)}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      height={H}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      className="block max-w-full"
      role="img"
    >
      <title>{title}</title>
      {yTicks.map(({ k, v, y }) => (
        <g key={k}>
          <line
            x1={padL}
            x2={W - padR}
            y1={y}
            y2={y}
            stroke="var(--line-lo)"
            strokeDasharray={Math.abs(v - lo) < 1e-9 ? "0" : "2 4"}
          />
          <text
            x={padL - 8}
            y={y + 3}
            textAnchor="end"
            fontSize="10"
            fontFamily="var(--f-mono)"
            fill="var(--ink-dim)"
          >
            {fmtUsd(v)}
          </text>
        </g>
      ))}
      <path
        d={bandPath}
        fill="var(--ink-mid)"
        fillOpacity={0.14}
        stroke="none"
      />
      <path
        d={medPath}
        stroke="var(--accent)"
        strokeWidth={1.5}
        fill="none"
      />
      {xLabelIdx.map((i) => (
        <text
          key={data[i].date}
          x={xAt(i)}
          y={H - padB + 16}
          fontSize="10"
          fontFamily="var(--f-mono)"
          fill="var(--ink-dim)"
          textAnchor="middle"
        >
          {data[i].date.slice(5)}
        </text>
      ))}
    </svg>
  );
}
