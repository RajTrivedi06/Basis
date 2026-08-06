import type { BulletinView } from "../sim/bulletinSim";

interface ExhibitADotsProps {
  view: BulletinView;
}

export function ExhibitADots({ view }: ExhibitADotsProps) {
  return (
    <figure className="bull-exhibit">
      <figcaption className="bull-exhibit__cap">
        <span>Exhibit A: The day&apos;s quotes, as received</span>
        <span className="bull-exhibit__cap-meta">
          {view.skuCode} · TODAY · <span className="bull-sim">[SIM]</span>
        </span>
      </figcaption>
      <svg viewBox="0 0 720 172" aria-hidden="true">
        <line
          x1="40"
          y1="146"
          x2="680"
          y2="146"
          stroke="var(--ink)"
          strokeWidth="1.5"
        />
        {view.dots.map((d, i) => (
          <circle
            key={i}
            cx={d.cx}
            cy={d.cy}
            r="4"
            fill="var(--ink)"
            opacity="0.78"
          />
        ))}
        <line
          x1={view.axMinX}
          y1="140"
          x2={view.axMinX}
          y2="152"
          stroke="var(--ink)"
          strokeWidth="1.5"
        />
        <line
          x1={view.axMedX}
          y1="140"
          x2={view.axMedX}
          y2="152"
          stroke="var(--accent)"
          strokeWidth="2"
        />
        <line
          x1={view.axMaxX}
          y1="140"
          x2={view.axMaxX}
          y2="152"
          stroke="var(--ink)"
          strokeWidth="1.5"
        />
        <text
          x={view.axMinX}
          y="166"
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize="12"
          fill="var(--ink)"
        >
          {view.minP}
        </text>
        <text
          x={view.axMedX}
          y="166"
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize="12"
          fill="var(--accent)"
        >
          MEDIAN {view.medP}
        </text>
        <text
          x={view.axMaxX}
          y="166"
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize="12"
          fill="var(--ink)"
        >
          {view.maxP}
        </text>
      </svg>
      <div className="bull-exhibit__foot">
        Each dot: one public quote, USD per GPU-hour, log scale. Vertical
        scatter is for legibility only.
      </div>
    </figure>
  );
}
