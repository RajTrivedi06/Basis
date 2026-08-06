import type { BulletinView } from "../sim/bulletinSim";

interface ExhibitDIqrProps {
  view: BulletinView;
}

export function ExhibitDIqr({ view }: ExhibitDIqrProps) {
  return (
    <figure className="bull-exhibit">
      <figcaption className="bull-exhibit__cap">
        <span>Exhibit D — Same quotes, now summarized</span>
        <span className="bull-exhibit__cap-meta">
          {view.skuCode} · TODAY · <span className="bull-sim">[SIM]</span>
        </span>
      </figcaption>
      <svg viewBox="0 0 720 172" aria-hidden="true">
        <rect
          x={view.bandX}
          y="24"
          width={view.bandW}
          height="108"
          fill="url(#bull-hE)"
          stroke="var(--ink-mid)"
          strokeWidth="1"
        />
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
            opacity="0.55"
          />
        ))}
        <line
          x1={view.axMedX}
          y1="16"
          x2={view.axMedX}
          y2="146"
          stroke="var(--accent)"
          strokeWidth="2.5"
        />
        <text
          x={view.axMedX}
          y="164"
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize="12"
          fill="var(--accent)"
        >
          MEDIAN {view.medP}
        </text>
        <text
          x={view.bandX}
          y="164"
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize="12"
          fill="var(--ink)"
        >
          P25 {view.p25P}
        </text>
        <text
          x={view.bandRX}
          y="164"
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize="12"
          fill="var(--ink)"
        >
          P75 {view.p75P}
        </text>
      </svg>
      <div className="bull-exhibit__foot">
        Observations {view.n} · Median {view.medP} · Middle half {view.p25P}–
        {view.p75P} · Minimum 3 quotes or the day is not reported.
      </div>
    </figure>
  );
}
