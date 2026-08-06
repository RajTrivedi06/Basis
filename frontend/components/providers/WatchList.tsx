"use client";

import { useId, useState } from "react";
import { isProviderRetired } from "@/lib/providerStatus";
import { sheetLabel } from "@/lib/nav";
import { deltaClause, providerDossier } from "@/lib/providerDossier";
import type { ProviderSummary } from "@/lib/types";

/** Deviations inside this band are parity, not a direction. */
const PARITY_EPSILON = 0.05;

function deviationSign(
  pct: number | null
): "above" | "below" | "parity" | "null" {
  if (pct === null) return "null";
  if (Math.abs(pct) < PARITY_EPSILON) return "parity";
  return pct > 0 ? "above" : "below";
}

function formatDeviation(pct: number | null): string {
  if (pct === null) return "-";
  // Arrow doubles the sign so the direction survives a greyscale print
  // and does not rely on colour alone. Exactly-level gets no arrow: a
  // zero deviation is parity, and claiming "below" would be false.
  if (Math.abs(pct) < PARITY_EPSILON) return `= ${Math.abs(pct).toFixed(1)}%`;
  const arrow = pct > 0 ? "↑" : "↓";
  return `${arrow} ${Math.abs(pct).toFixed(1)}%`;
}

/** UTC stamp matching the sheet voice: "AUG 3 · 06:12". */
export function formatObserved(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const mon = d
    .toLocaleString("en-US", { month: "short", timeZone: "UTC" })
    .toUpperCase();
  const day = d.getUTCDate();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${mon} ${day} · ${hh}:${mm}`;
}

function WatchRow({
  p,
  open,
  onToggle,
}: {
  p: ProviderSummary;
  open: boolean;
  onToggle: () => void;
}) {
  const retired = isProviderRetired(p);
  const meta = providerDossier(p.provider);
  const panelId = useId();
  const sign = deviationSign(p.median_deviation_pct);

  return (
    <div className={`watch-row${open ? " is-open" : ""}${retired ? " is-retired" : ""}`}>
      <button
        type="button"
        className="watch-row__main"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className="watch-row__subject">
          <span className="watch-row__key">{p.provider}</span>
          {retired ? <span className="watch-row__retired">RETIRED</span> : null}
        </span>
        <span className="watch-row__role">{meta.role}</span>
        <span className="watch-row__offers">
          {p.offer_count.toLocaleString("en-US")}
        </span>
        <span className="watch-row__skus">{p.distinct_skus}</span>
        <span className="watch-row__delta" data-sign={sign}>
          {formatDeviation(p.median_deviation_pct)}
        </span>
        <span className="watch-row__latest">
          {formatObserved(p.latest_collection)}
        </span>
        <span className="watch-row__caret" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
        <span className="watch-row__mobile-meta">
          <span>
            {p.offer_count.toLocaleString("en-US")} offers · {p.distinct_skus}{" "}
            SKUs
          </span>
          <span>latest {formatObserved(p.latest_collection)}</span>
        </span>
      </button>

      {open ? (
        <div className="watch-row__dossier" id={panelId}>
          <div className="watch-row__conduct">
            <div className="watch-row__dossier-label">
              DOSSIER · OBSERVED CONDUCT
            </div>
            <p className="watch-row__dossier-body">
              <span className="watch-row__dossier-live">
                {deltaClause(p.median_deviation_pct)}
              </span>{" "}
              {meta.dossier}
            </p>
          </div>
          <div className="watch-row__provenance">
            <div className="watch-row__dossier-label watch-row__dossier-label--dim">
              PROVENANCE
            </div>
            <p className="watch-row__provenance-body">
              FILE No. {meta.file}
              <br />
              SOURCE: GET /api/providers
              <br />
              FIELD: median_deviation_pct
              <br />
              BASIS: LATEST COLLECTION DATE
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Declassified watch list — one sheet, one row per subject, dossiers on
 * request. Figures are exactly what GET /api/providers returns.
 */
export function WatchList({ items }: { items: ProviderSummary[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [howOpen, setHowOpen] = useState(false);
  const howId = useId();

  return (
    <div className="watch" data-watch>
      <div className="watch__banner">
        <span className="watch__stamp">
          <span className="watch__strike" aria-hidden />
          TOP SECRET
        </span>
        <span className="watch__overstamp">
          OVERSTAMPED: DECLASSIFIED: EVERY FIGURE HERE IS PUBLIC
        </span>
        <span className="watch__sheet-id">WATCH LIST · {sheetLabel("/providers")}</span>
      </div>

      <div className="watch__cols" aria-hidden>
        <span>SUBJECT · CANONICAL KEY</span>
        <span>ROLE IN THE MARKET</span>
        <span className="watch__cols-right">OFFERS</span>
        <span className="watch__cols-right">SKUS</span>
        <span className="watch__cols-right">MEDIAN Δ VS MARKET</span>
        <span className="watch__cols-right">LAST OBSERVED</span>
        <span />
      </div>

      <div className="watch__rows">
        {items.map((p) => (
          <WatchRow
            key={p.provider}
            p={p}
            open={openKey === p.provider}
            onToggle={() =>
              setOpenKey((cur) => (cur === p.provider ? null : p.provider))
            }
          />
        ))}
      </div>

      <div className="watch__foot">
        <button
          type="button"
          className="watch__how-toggle"
          aria-expanded={howOpen}
          aria-controls={howId}
          onClick={() => setHowOpen((v) => !v)}
        >
          {howOpen ? "−" : "+"} SHOW ME HOW Δ VS MARKET IS COMPUTED
        </button>
        <span className="watch__footnote">
          ARROWS CARRY THE SIGN; COLOR IS NOT LOAD-BEARING
        </span>
      </div>

      {howOpen ? (
        <div className="watch__how-body" id={howId}>
          <p>
            Mean across SKUs of (provider median − market median) ÷ market
            median, on the latest collection date. Market median is the
            all-providers rollup. SKUs with no usable market median are
            skipped, never zero-filled.
          </p>
          <p>
            Positive sits above the market, negative below. It is a{" "}
            <span className="watch__how-accent">posture, not a verdict</span>: a
            subject may sit high because its regions or bundles differ, not
            because the same offer costs more. That confusion is what the
            decomposition exists to settle.
          </p>
        </div>
      ) : null}
    </div>
  );
}
