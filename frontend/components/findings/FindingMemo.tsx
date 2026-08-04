"use client";

import { FindingExhibit, type ExhibitPoint } from "./FindingExhibit";

export interface MemoFacts {
  sku: string;
  /** In-sample share the four observable factors claim, percent. */
  anovaPct: number | null;
  /** Out-of-sample gap in percentage points (negative IS the finding). */
  gapPp: number | null;
  /** Host-identity intra-class correlation. */
  icc: number | null;
  /** Latest unexplained share in the window, percent. */
  todayPct: number | null;
  /** Short date the anchors were trained (A6 — never hardcoded). */
  trainedDate: string | null;
  points: ExhibitPoint[];
}

const DASH = "—";

/**
 * The declassified finding memorandum (design 4a, Findings Hero
 * Explorations). Every figure is live-loaded; the void redaction bar is the
 * only thing on the page allowed to encode the unexplained share.
 *
 * Text that types in during the entrance carries `data-type`; the full
 * string is what server-renders, so the resting DOM is always complete for
 * tests, greps, and no-JS readers.
 */
export function FindingMemo({ facts }: { facts: MemoFacts }) {
  const { sku, anovaPct, gapPp, icc, todayPct, trainedDate, points } = facts;

  return (
    <div className="memo" data-memo>
      <div className="memo__band">DECLASSIFIED · PUBLIC DATA</div>

      <div className="memo__meta">
        <span>BASIS · PRICING ANOMALY DIVISION</span>
        <span>
          FINDING · AS OF {trainedDate ? trainedDate.toUpperCase() : DASH}{" "}
          <span className="memo__live">LIVE</span>
        </span>
      </div>

      <div className="memo__subject">
        SUBJECT: UNACCOUNTED PRICE VARIATION — {sku}
      </div>

      <div className="memo__rule" />

      <dl className="memo__lines">
        <MemoLine
          n="1"
          label="FOUR FACTORS, IN-SAMPLE"
          value={anovaPct === null ? DASH : `CLAIMED ${anovaPct.toFixed(1)}%`}
        />
        <MemoLine
          n="2"
          label="45 FEATURES, OUT-OF-SAMPLE"
          value={
            gapPp === null
              ? DASH
              : `LESS · ${gapPp < 0 ? "−" : "+"}${Math.abs(gapPp).toFixed(1)}pp`
          }
          accent
        />
        <MemoLine
          n="3"
          label="RESIDUAL TRACED TO HOSTS"
          value={icc === null ? DASH : `ICC ${icc.toFixed(2)}`}
        />
        <MemoLine
          n="4"
          label="CAUSE OF REMAINDER"
          value={todayPct === null ? DASH : `${todayPct.toFixed(0)}%`}
          redacted
        />
      </dl>

      <div className="memo__note-row">
        <p className="memo__note">
          NOTE: THE REDACTION IS THE MARKET&rsquo;S, NOT OURS.
          <br />
          THE SHARE HAS RANGED ~20–61% ACROSS RECENT WEEKS.
        </p>
        <span className="memo__stamp" aria-hidden="true">
          UNEXPLAINED
        </span>
      </div>

      <div className="memo__rule" />

      {points.length > 1 ? (
        <FindingExhibit points={points} />
      ) : (
        <p className="memo__note">EXHIBIT UNAVAILABLE — RECORD NOT LOADED.</p>
      )}

      <div className="memo__band memo__band--foot">THE FILE STAYS OPEN</div>
    </div>
  );
}

function MemoLine({
  n,
  label,
  value,
  accent = false,
  redacted = false,
}: {
  n: string;
  label: string;
  value: string;
  accent?: boolean;
  redacted?: boolean;
}) {
  return (
    <div className="memo-line">
      <dt className="memo-line__label">
        <span data-type>
          {n}. {label}
        </span>
      </dt>
      <span className="memo-line__leader" aria-hidden="true" />
      <dd
        className="memo-line__value"
        data-accent={accent ? "true" : undefined}
      >
        {redacted && <span className="memo-line__redaction" aria-hidden="true" />}
        <span className="memo-line__figure">{value}</span>
        <span className="memo__live">LIVE</span>
      </dd>
    </div>
  );
}
