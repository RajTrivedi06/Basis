"use client";

import type { BulletinView, FactorKey } from "../sim/bulletinSim";
import { BulletinStamp } from "../BulletinStamp";

interface ExhibitELedgerProps {
  view: BulletinView;
  onMove: (index: number, delta: number) => void;
}

export function ExhibitELedger({ view, onMove }: ExhibitELedgerProps) {
  return (
    <figure className="bull-exhibit bull-exhibit--strong">
      <figcaption className="bull-exhibit__cap">
        <span>Exhibit E — The ledger of accounts (operable)</span>
        <span className="bull-exhibit__cap-meta">
          {view.skuCode} · MARKET-PRICED PANEL, n = {view.mktN} ·{" "}
          <span className="bull-sim">[SIM]</span>
        </span>
      </figcaption>
      <div style={{ padding: "14px 14px 4px" }}>
        <svg viewBox="0 0 720 92" aria-hidden="true">
          <text
            x="40"
            y="16"
            fontFamily="var(--font-sans, system-ui), sans-serif"
            fontSize="11"
            letterSpacing="2"
            fill="var(--ink-mid)"
          >
            ALL DISAGREEMENT, 100% —— SUBTRACTED LEFT TO RIGHT
          </text>
          {view.segs.map((g) => (
            <rect
              key={g.key}
              x={g.x}
              y="28"
              width={Math.max(g.w, 0)}
              height="42"
              fill={g.fill}
              stroke="var(--ink)"
              strokeWidth="1.2"
            />
          ))}
          <rect
            x={view.residX}
            y="28"
            width={Math.max(view.residW, 0)}
            height="42"
            fill="var(--residual)"
          />
          <text
            x={view.residMidX}
            y="86"
            textAnchor="middle"
            fontFamily="var(--font-mono), monospace"
            fontSize="12.5"
            fill="var(--accent)"
          >
            REMAINDER {view.residPct}%
          </text>
        </svg>
      </div>
      <div
        className="bull-ledger-wrap"
        role="group"
        aria-label="Reorder the subtraction"
      >
        <table className="bull-table">
          <thead>
            <tr>
              <th scope="col">Order</th>
              <th scope="col">Cause subtracted</th>
              <th scope="col" style={{ textAlign: "right" }}>
                Share credited
              </th>
              <th scope="col" style={{ textAlign: "right" }}>
                Move
              </th>
            </tr>
          </thead>
          <tbody>
            {view.rows.map((r, i) => (
              <tr key={r.key as FactorKey}>
                <td>{r.pos}</td>
                <td>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    style={{ verticalAlign: "-2px" }}
                    aria-hidden="true"
                  >
                    <rect
                      x="0.5"
                      y="0.5"
                      width="13"
                      height="13"
                      fill={r.fill}
                      stroke="var(--ink)"
                    />
                  </svg>{" "}
                  {r.label}
                </td>
                <td style={{ textAlign: "right" }}>{r.pct}%</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <button
                    type="button"
                    className="bull-move"
                    disabled={r.upDis}
                    aria-label={`Subtract ${r.key} earlier`}
                    onClick={() => onMove(i, -1)}
                  >
                    ▲
                  </button>{" "}
                  <button
                    type="button"
                    className="bull-move"
                    disabled={r.downDis}
                    aria-label={`Subtract ${r.key} later`}
                    onClick={() => onMove(i, 1)}
                  >
                    ▼
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td style={{ fontWeight: 700 }}>—</td>
              <td>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  style={{ verticalAlign: "-2px" }}
                  aria-hidden="true"
                >
                  <rect
                    x="0.5"
                    y="0.5"
                    width="13"
                    height="13"
                    fill="var(--residual)"
                  />
                </svg>{" "}
                THE REMAINDER — UNEXPLAINED
                <BulletinStamp size="sm" className="bull-stamp--inline">
                  Cannot be filed
                </BulletinStamp>
              </td>
              <td
                style={{
                  textAlign: "right",
                  color: "var(--accent)",
                  fontWeight: 700,
                }}
              >
                {view.residPct}%
              </td>
              <td
                style={{
                  textAlign: "right",
                  fontSize: 11,
                  color: "var(--ink-mid)",
                }}
              >
                FIXED UNDER ANY ORDER
              </td>
            </tr>
          </tbody>
        </table>
        <div className="bull-ledger-note">
          Current order: {view.orderText} · Reorder freely — the shares move;
          the remainder does not.
        </div>
      </div>
    </figure>
  );
}
