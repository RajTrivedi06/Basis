"use client";

import { GlossaryTerm } from "@/components/glossary/GlossaryTerm";
import {
  BoundStrip,
  formatGapPp,
  formatPct,
} from "@/components/explainability/BoundStrip";
import { formatMemoDate } from "@/lib/memoDate";
import type { ExplainabilityArtifact } from "@/lib/mlExplainabilityTypes";

interface TwoCardFileProps {
  artifact: ExplainabilityArtifact;
}

function ShapTally({
  features,
}: {
  features: { feature: string; mean_abs_shap: number }[];
}) {
  const max =
    features.length > 0
      ? Math.max(...features.map((f) => f.mean_abs_shap), 0.0001)
      : 1;
  const colA = features.slice(0, 3);
  const colB = features.slice(3, 6);

  const Col = ({ rows }: { rows: typeof features }) => (
    <div className="shap-tally__col">
      {rows.map((f) => (
        <div className="shap-tally__row" key={f.feature}>
          <span className="shap-tally__name">{f.feature}</span>
          <span
            className="shap-tally__bar"
            style={{ width: `${Math.round((f.mean_abs_shap / max) * 100)}%` }}
          />
        </div>
      ))}
    </div>
  );

  if (features.length === 0) {
    return (
      <p className="exhibit-card__dim">No SHAP features in this artifact.</p>
    );
  }

  return (
    <div className="shap-tally">
      <Col rows={colA} />
      <Col rows={colB} />
    </div>
  );
}

/**
 * Design 5b — two tabbed index cards: Exhibit I the bound, Exhibit II the host.
 * Every figure is artifact-loaded; void encodes the residual alone.
 */
export function TwoCardFile({ artifact }: TwoCardFileProps) {
  const { metadata, metrics, shap_summary, host_analysis, caveats } = artifact;
  const { holdout, anova_explained_same_days, gap, r2_holdout_by_provider } =
    metrics;
  const host = host_analysis;

  const sensIccs = [
    host.icc,
    ...host.sensitivity.map((s) => s.icc),
  ];
  const swing = Math.max(...sensIccs) - Math.min(...sensIccs);
  const trained = formatMemoDate(metadata.trained_at);
  const corpusThrough = formatMemoDate(metadata.corpus_through);

  // Sensitivity rows: include primary threshold from the host analysis.
  const sensRows = [
    ...host.sensitivity
      .filter((s) => s.threshold < host.min_days_threshold)
      .map((s) => ({
        th: `≥ ${s.threshold} D`,
        icc: s.icc.toFixed(2),
        primary: false,
      })),
    {
      th: `≥ ${host.min_days_threshold} D`,
      icc: `${host.icc.toFixed(2)} · PRIMARY`,
      primary: true,
    },
    ...host.sensitivity
      .filter((s) => s.threshold > host.min_days_threshold)
      .map((s) => ({
        th: `≥ ${s.threshold} D`,
        icc: s.icc.toFixed(2),
        primary: false,
      })),
  ];

  return (
    <div className="two-card" data-two-card>
      <div className="two-card__exhibits">
        {/* ——— EXHIBIT I ——— */}
        <div className="exhibit exhibit--bound">
          <div className="exhibit__tab">EXHIBIT I — THE BOUND</div>
          <div className="exhibit-card exhibit-card--bound">
            <div className="exhibit-card__meta">
              <span>
                {metadata.sku} · {holdout.n_days}-DAY HOLDOUT
              </span>
              <span>
                TRAINED {trained}{" "}
                <span className="exhibit-card__live">LIVE</span>
              </span>
            </div>

            <BoundStrip
              anovaExplained={anova_explained_same_days}
              gbmR2={holdout.r2_oos}
              gap={gap}
            />

            <div className="exhibit-stats">
              <div className="exhibit-stats__cell">
                <div className="exhibit-stats__label">GBM HOLDOUT R²</div>
                <div className="exhibit-stats__value exhibit-stats__value--accent">
                  {formatPct(holdout.r2_oos)}
                </div>
                <div className="exhibit-stats__detail">OUT-OF-SAMPLE</div>
              </div>
              <div className="exhibit-stats__cell">
                <div className="exhibit-stats__label">ANOVA, SAME DAYS</div>
                <div className="exhibit-stats__value">
                  {formatPct(anova_explained_same_days)}
                </div>
                <div className="exhibit-stats__detail">IN-SAMPLE</div>
              </div>
              <div className="exhibit-stats__cell">
                <div className="exhibit-stats__label">GAP</div>
                <div className="exhibit-stats__value exhibit-stats__value--accent">
                  {formatGapPp(gap)}
                </div>
                <div className="exhibit-stats__detail">SHORTFALL</div>
              </div>
            </div>

            <div className="exhibit-card__section">
              <div className="exhibit-card__section-label">
                HOLDOUT R² BY PROVIDER — PUNCHED:
              </div>
              <div className="punch-row">
                {Object.entries(r2_holdout_by_provider).map(([provider, r2]) => (
                  <span className="punch" key={provider}>
                    {provider.toUpperCase()}
                    <span className="punch__val">{r2.toFixed(2)}</span>
                  </span>
                ))}
              </div>
              <p className="exhibit-card__dim">
                NOT EVENLY HARD: FEATURE-RICH CATALOGS GIVE THE MODEL MORE
                DESCRIBABLE DETAIL; A SHORT CATALOG LINE GIVES IT ALMOST NOTHING.
              </p>
            </div>

            <div className="exhibit-card__section">
              <div className="exhibit-card__section-label">
                WHAT IT LEANED ON — MEAN |SHAP|:
              </div>
              <ShapTally features={shap_summary.top_features} />
            </div>
          </div>
        </div>

        {/* ——— EXHIBIT II ——— */}
        <div className="exhibit exhibit--host">
          <div className="exhibit__tab">EXHIBIT II — THE HOST</div>
          <div className="exhibit-card exhibit-card--host">
            <div className="exhibit-card__meta">
              VAST HOST IDENTITY · ON-DEMAND PANEL
            </div>

            <div className="host-hero">
              <span className="host-hero__icc">{host.icc.toFixed(2)}</span>
              <span className="host-hero__label">
                <GlossaryTerm term="icc">ICC</GlossaryTerm>{" "}
                <span className="exhibit-card__live">LIVE</span>
              </span>
            </div>
            <p className="host-hero__lede">
              HOW MUCH OF THE LEFTOVER VARIATION STICKS TO THE SAME SPECIFIC
              MACHINES DAY AFTER DAY. IDENTITY, NOT SPECIFICATION.
            </p>

            <div className="host-metrics">
              <span>
                <span className="host-metrics__label">
                  HOSTS ≥{host.min_days_threshold}D
                </span>
                <br />
                {host.n_hosts}
              </span>
              <span>
                <span className="host-metrics__label">HOST-DAYS</span>
                <br />
                {host.n_host_days.toLocaleString("en-US")}
              </span>
              <span>
                <span className="host-metrics__label">FE R² INCREMENT</span>
                <br />+{host.fe_r2_increment.toFixed(2)}
              </span>
              <span>
                <span className="host-metrics__label">MAX TENURE</span>
                <br />
                {host.tenure_days.max} D
              </span>
            </div>

            <div className="exhibit-card__section">
              <div className="exhibit-card__section-label">
                ICC SENSITIVITY BY TENURE THRESHOLD:
              </div>
              <div className="sens-leaders">
                {sensRows.map((row) => (
                  <div className="sens-leaders__row" key={row.th}>
                    <span className="sens-leaders__th">{row.th}</span>
                    <span className="sens-leaders__leader" aria-hidden />
                    <span className="sens-leaders__icc">{row.icc}</span>
                  </div>
                ))}
              </div>
              <p className="exhibit-card__dim">
                SWING {swing.toFixed(2)} —{" "}
                {swing < 0.15
                  ? "BELOW THE 0.15 FLAG. NO THRESHOLD WAS CHOSEN FOR FLATTERY."
                  : "ABOVE THE 0.15 FLAG — READ WITH CARE."}
              </p>
            </div>

            <div className="exhibit-card__stamp" aria-hidden>
              IDENTITY, NOT SPECS
            </div>
          </div>
        </div>
      </div>

      <div className="two-card__foot">
        <div className="two-card__caveats" aria-label="Mandatory caveats">
          <span className="two-card__caveats-label">
            CAVEATS — READ BEFORE INTERPRETING:{" "}
          </span>
          {caveats.map((caveat, i) => (
            <span key={caveat}>
              {i > 0 ? <span aria-hidden> · </span> : null}
              <span>{caveat}</span>
            </span>
          ))}
        </div>
        <div className="two-card__corpus">
          CORPUS THROUGH {corpusThrough}
          <br />
          {metadata.corpus_rows.toLocaleString("en-US")} ROWS · TRAINED{" "}
          {trained}
        </div>
      </div>
    </div>
  );
}
