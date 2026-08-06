"use client";

import type { BulletinView } from "../sim/bulletinSim";

interface ExhibitFSeriesProps {
  view: BulletinView;
  catalogs: boolean;
  onToggleCatalogs: () => void;
}

export function ExhibitFSeries({
  view,
  catalogs,
  onToggleCatalogs,
}: ExhibitFSeriesProps) {
  return (
    <figure className="bull-exhibit bull-exhibit--strong">
      <figcaption className="bull-exhibit__cap">
        <span>Exhibit F: The unexplained share, 60 days (operable)</span>
        <span className="bull-exhibit__cap-meta">
          {view.skuCode} · <span className="bull-sim">[SIM]</span>
        </span>
      </figcaption>
      <div className="bull-series-ctrl">
        <button
          type="button"
          className="bull-toggle"
          aria-pressed={catalogs}
          onClick={onToggleCatalogs}
        >
          {catalogs ? "☑" : "☐"} INCLUDE ADMINISTERED CATALOGS (AZURE, GCP)
        </button>
        <div className="bull-pop-title">{view.popTitle}</div>
      </div>
      <svg viewBox="0 0 720 232" aria-hidden="true">
        <line
          x1="40"
          y1="200"
          x2="690"
          y2="200"
          stroke="var(--ink)"
          strokeWidth="1.5"
        />
        <line
          x1="40"
          y1="200"
          x2="40"
          y2="20"
          stroke="var(--ink)"
          strokeWidth="1.5"
        />
        <text
          x="34"
          y="26"
          textAnchor="end"
          fontFamily="var(--font-mono), monospace"
          fontSize="11"
          fill="var(--ink-mid)"
        >
          90%
        </text>
        <text
          x="34"
          y="118"
          textAnchor="end"
          fontFamily="var(--font-mono), monospace"
          fontSize="11"
          fill="var(--ink-mid)"
        >
          45%
        </text>
        <text
          x="34"
          y="204"
          textAnchor="end"
          fontFamily="var(--font-mono), monospace"
          fontSize="11"
          fill="var(--ink-mid)"
        >
          0%
        </text>
        <path
          d={view.ghostPath}
          fill="none"
          stroke="var(--ink-mid)"
          strokeWidth="1.2"
          strokeDasharray="4 4"
        />
        <path
          d={view.seriesPath}
          fill="none"
          stroke="var(--ink)"
          strokeWidth="2.4"
        />
        <circle
          cx={view.lastX}
          cy={view.lastY}
          r="4.5"
          fill="var(--accent)"
        />
        <text
          x={view.lastLabelX}
          y={view.lastLabelY}
          textAnchor="end"
          fontFamily="var(--font-mono), monospace"
          fontSize="13"
          fill="var(--accent)"
        >
          {view.activePct}%
        </text>
        <text
          x="42"
          y="222"
          fontFamily="var(--font-mono), monospace"
          fontSize="11"
          fill="var(--ink-mid)"
        >
          60 DAYS AGO
        </text>
        <text
          x="688"
          y="222"
          textAnchor="end"
          fontFamily="var(--font-mono), monospace"
          fontSize="11"
          fill="var(--ink-mid)"
        >
          TODAY
        </text>
      </svg>
      <div className="bull-exhibit__foot">
        Solid line: {view.popTitle}. Dashed: the other population, for
        comparison. Today <span className="bull-sim">[SIM]</span>: market-priced{" "}
        {view.marketPct}% · pooled {view.pooledPct}%.
      </div>
      <details className="bull-annex" style={{ margin: 0, border: "none", borderTop: "1px solid var(--bull-rule-faint)" }}>
        <summary style={{ color: "var(--ink-mid)", fontSize: 12 }}>
          Exhibit F as a table (for the record)
        </summary>
        <div className="bull-annex__body">
          <table className="bull-table" style={{ width: "auto", margin: "4px 0 0" }}>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col" style={{ textAlign: "right" }}>
                  Unexplained share
                </th>
              </tr>
            </thead>
            <tbody>
              {view.seriesRows.map((t) => (
                <tr key={t.day}>
                  <td>{t.day}</td>
                  <td style={{ textAlign: "right" }}>{t.val}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
