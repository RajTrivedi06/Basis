import type { Metadata } from "next";
import Link from "next/link";
import { BracketDiagram } from "@/components/marks/BracketDiagram";
import { BracketMark } from "@/components/marks/BracketMark";
import { ShowMeHow } from "@/components/disclosure/TwoLayer";
import { FilmRibbon } from "@/components/story/FilmRibbon";
import { FindingsFile } from "@/components/story/FindingsFile";
import { PlateFrame } from "@/components/story/PlateFrame";
import { QuoteLanes } from "@/components/story/QuoteLanes";
import { RedactedLine } from "@/components/story/RedactedLine";
import { Reel, ReelFrame } from "@/components/story/Reel";
import { SettlementSheet } from "@/components/story/SettlementSheet";
import { StoryMotion } from "@/components/story/StoryMotion";
import { Tally } from "@/components/story/Tally";
import {
  commitmentLabel,
  multipleWord,
  regionLabel,
  titleCase,
  usd,
} from "@/lib/fileCopy";
import {
  COLD_OPEN,
  FINDING_ANALYST,
  NAME_STILL,
  PUZZLE_HYPERSCALER,
  PUZZLE_MARKETPLACE,
  STAKES_FLOOR,
  type PlateSpec,
} from "@/lib/plates";
import { providerLabel } from "@/lib/providerLabel";
import {
  CATALOG_PROVIDERS,
  COLLECTIONS_PER_DAY,
  getStoryData,
  HERO_SKU,
  shortDate,
  stampDate,
  type HeroBounds,
} from "@/lib/story";

// C22: the five-second layer. Title/description carry the one-liner.
// Director rider on C23: the full name lives in author meta + OG only —
// page copy renders Raj's attribution exactly as written.
export const metadata: Metadata = {
  title: "Basis — measuring what the GPU market cannot explain.",
  description: "Basis — measuring what the GPU market cannot explain.",
  authors: [
    { name: "Raj Trivedi", url: "https://github.com/RajTrivedi06/Basis" },
  ],
  openGraph: {
    title: "Basis — measuring what the GPU market cannot explain.",
    description:
      "A public-data research study of GPU-hour pricing by Raj Trivedi.",
    type: "website",
  },
};

export const revalidate = 900;

const COUNT_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
];

function countWord(n: number | null): string {
  if (n === null) return "the";
  return COUNT_WORDS[n] ?? String(n);
}

export default async function StoryPage() {
  const {
    bounds,
    activeProviders,
    totalOffers,
    skuCount,
    decomposition,
    residualRange,
    quotes,
    artifact,
    collectedAt,
  } = await getStoryData();

  const providerCount = activeProviders.length > 0 ? activeProviders.length : null;
  const providerWord = countWord(providerCount);

  const gapPp = artifact ? artifact.metrics.gap * 100 : null;
  const icc = artifact?.host_analysis.icc ?? null;
  const iccThreshold = artifact?.host_analysis.min_days_threshold ?? null;
  const hostCount = artifact?.host_analysis.n_hosts ?? null;
  const sensitivity = artifact?.host_analysis.sensitivity ?? [];
  const trainedDate = artifact ? shortDate(artifact.metadata.trained_at) : null;
  const anovaPct = artifact
    ? artifact.metrics.anova_explained_same_days * 100
    : null;
  const gbmPct = artifact ? artifact.metrics.holdout.r2_oos * 100 : null;
  const holdoutDays = artifact?.metrics.holdout.n_days ?? null;
  const permuted = artifact?.metrics.permuted_target_r2 ?? null;

  const population = `market-priced · ${CATALOG_PROVIDERS.map(providerLabel).join(
    " and "
  )} excluded`;

  return (
    <div className="filecopy">
      <StoryMotion />
      <FilmRibbon />

      {/* ——————————————————————————————— I · Cold open (C1) */}
      <section className="fc-act fc-act--open" aria-labelledby="fc-hook">
        <PlateFrame plate={COLD_OPEN} depth={0.16} priority showSlate={false} />
        <div className="fc-act__scrim" aria-hidden />

        <div className="fc-open">
          <div className="fc-open__head" data-stamp>
            <span className="fc-eyebrow">The price of one GPU-hour</span>
            <span className="fc-open__rule" aria-hidden />
            <span className="fc-eyebrow fc-eyebrow--accent">
              File copy · not for publication
            </span>
          </div>

          <h1 id="fc-hook" className="fc-open__head-line serif" data-lines>
            <span className="fc-line">
              <span>Identical hardware.</span>
            </span>
            <span className="fc-line">
              <span>Quoted the same day.</span>
            </span>
            <span className="fc-line">
              <span>
                {bounds
                  ? `${titleCase(multipleWord(bounds.multiple))} times apart.`
                  : "Priced worlds apart."}
              </span>
            </span>
          </h1>

          {bounds ? (
            <div className="fc-pair" data-stamp>
              <div className="fc-pair__side">
                <span className="fc-pair__price serif">
                  <Tally value={bounds.low} prefix="$" decimals={2} />
                </span>
                <span className="fc-pair__foot">
                  {providerLabel(bounds.lowOffer.provider)} ·{" "}
                  {commitmentLabel(bounds.lowOffer.commitment)}
                </span>
              </div>

              {/* The measurement is set in HTML rather than inside the SVG:
                  an SVG label scales with the viewBox, and at 390px the
                  bracket is 60px wide, which would render the hero's one
                  quantity at about six pixels. */}
              <div className="fc-pair__gap">
                <span className="fc-pair__multiple">
                  {bounds.multiple.toFixed(1)}×
                </span>
                <svg
                  className="fc-pair__bracket"
                  viewBox="0 0 220 30"
                  role="img"
                  aria-label={`A ${bounds.multiple.toFixed(
                    1
                  )} times difference between the two quotes.`}
                >
                  <BracketMark
                    orientation="horizontal"
                    spine={16}
                    start={6}
                    length={208}
                    tone="ink"
                    tick={5}
                    strokeWidth={1.2}
                  />
                </svg>
              </div>

              <div className="fc-pair__side fc-pair__side--high">
                <span className="fc-pair__price serif">
                  <Tally value={bounds.high} prefix="$" decimals={2} />
                </span>
                <span className="fc-pair__foot">
                  {providerLabel(bounds.highOffer.provider)} ·{" "}
                  {commitmentLabel(bounds.highOffer.commitment)}
                </span>
              </div>
            </div>
          ) : null}

          <div className="fc-open__foot" data-stamp data-stamp-group>
            <p className="fc-open__lede">
              Basis is a public study of the part of that price nothing
              observable explains. Every figure here walks back to the raw
              response a provider returned.
            </p>
            <p className="fc-open__slate">
              {bounds
                ? `p5 and p95 of ${bounds.sampleSize} quotes · ${HERO_SKU}`
                : `${HERO_SKU} · live quotes momentarily unavailable`}
              {collectedAt ? ` · ${stampDate(collectedAt)}` : ""}
            </p>
          </div>
        </div>

        <span className="fc-open__cue" aria-hidden>
          Scroll to open the file
        </span>
      </section>

      {/* ——————————————————————————————— II · The brief (C2, C3) */}
      <section className="fc-act fc-act--brief" aria-labelledby="fc-brief">
        <div className="fc-punch" aria-hidden />
        <div className="fc-wrap fc-brief">
          <div className="fc-brief__copy">
            <span className="fc-eyebrow fc-eyebrow--accent">01 · The brief</span>
            <h2 id="fc-brief" className="fc-h2 serif" data-lines>
              <span className="fc-line">
                <span>A commodity is a thing</span>
              </span>
              <span className="fc-line">
                <span>that trades at one price.</span>
              </span>
            </h2>
            <p className="fc-body">
              A GPU-hour should be one of them. Wheat is wheat. Oil is oil. An
              H100 is an H100, and the silicon is identical.
              <sup className="fc-fn">
                <a href="#sources">1</a>
              </sup>{" "}
              So identical things should cost roughly the same.{" "}
              <strong>They don&rsquo;t. Not even close.</strong>
            </p>
            <p className="fc-body">
              Nobody had published, on public data, with a method you can rerun,
              how much of that price is actually explainable. So we started
              asking twice a day, and writing down every answer.
            </p>

            <div className="fc-redact-card" data-stamp>
              <span className="fc-slate-label">
                Paragraph 4 · struck on receipt · lift it
              </span>
              <RedactedLine
                before="Every figure in this file walks back to "
                redacted="the raw response"
                after=" a provider returned, and none of it came from a paid feed."
              />
            </div>

            <ul className="fc-chips" data-stamp data-stamp-group>
              <li>A study, not a product</li>
              <li>No paywalled feeds</li>
              <li className="fc-chips__accent">Every figure has a receipt</li>
            </ul>
          </div>

          <aside className="fc-registry" data-stamp>
            <div className="fc-registry__head">
              <span>Registry summary</span>
              <span className="fc-registry__live">Live</span>
            </div>
            <dl className="fc-registry__rows">
              <RegistryRow
                label="Canonical offers"
                value={
                  totalOffers === null ? null : (
                    <Tally value={totalOffers} grouping />
                  )
                }
              />
              <RegistryRow
                label="Canonical SKUs"
                value={skuCount === null ? null : <Tally value={skuCount} />}
              />
              <RegistryRow
                label="Public catalogs"
                value={providerCount === null ? null : String(providerCount)}
              />
              <RegistryRow
                label="Collections per day"
                value={String(COLLECTIONS_PER_DAY)}
              />
            </dl>
            <p className="fc-registry__foot">
              Quoted prices only. No transactions claimed. Raw responses are
              write-once and kept.
            </p>
          </aside>
        </div>
      </section>

      {/* ——————————————————————————————— III · Exhibit A */}
      <section className="fc-act fc-act--exhibit-a" aria-labelledby="fc-exhibit-a">
        <div className="fc-wrap">
          <span className="fc-eyebrow fc-eyebrow--accent">02 · Exhibit A</span>
          <h2 id="fc-exhibit-a" className="fc-h2 serif" data-lines>
            <span className="fc-line">
              <span>Two quotes for the same</span>
            </span>
            <span className="fc-line">
              <span>eighty gigabytes of silicon.</span>
            </span>
          </h2>

          {bounds ? (
            <>
              <div className="fc-tags">
                <PriceTag
                  offer={bounds.lowOffer}
                  plate={PUZZLE_MARKETPLACE}
                />
                <div className="fc-tags__divider" aria-hidden>
                  <svg
                    className="fc-tags__bracket"
                    viewBox="0 0 28 140"
                    role="presentation"
                  >
                    <BracketMark
                      orientation="vertical"
                      spine={14}
                      start={10}
                      length={120}
                      tone="ink"
                      tick={5}
                      strokeWidth={1.2}
                    />
                  </svg>
                  <span className="fc-tags__aside">
                    <span>same</span>
                    <span>hardware</span>
                    <span>same</span>
                    <span>day</span>
                  </span>
                </div>
                <PriceTag
                  offer={bounds.highOffer}
                  plate={PUZZLE_HYPERSCALER}
                  high
                />
              </div>
              <div className="fc-field-note" data-stamp>
                <p>
                  Field note ·{" "}
                  {providerLabel(bounds.lowOffer.provider)}{" "}
                  {regionLabel(bounds.lowOffer.region)}{" "}
                  {usd(bounds.lowOffer.price)} versus{" "}
                  {providerLabel(bounds.highOffer.provider)}{" "}
                  {regionLabel(bounds.highOffer.region)}{" "}
                  {usd(bounds.highOffer.price)}.{" "}
                  {bounds.crossProvider
                    ? "Two sellers, one canonical chip, the same collection day."
                    : "One catalog, one canonical chip, the same collection day."}
                </p>
                <span className="fc-field-note__multiple">
                  {bounds.multiple.toFixed(1)}×
                </span>
              </div>
            </>
          ) : (
            <p className="fc-body">
              Live quotes are momentarily unavailable. The dispersion page keeps
              the full record.
            </p>
          )}
        </div>
      </section>

      {/* ——————————————————————————————— IV · The name (C24) */}
      <section className="fc-act fc-act--name" aria-labelledby="fc-name">
        <PlateFrame
          plate={NAME_STILL}
          depth={0.1}
          className="fc-plate--mobile-only"
          showSlate={false}
        />
        <div className="fc-act__scrim fc-act__scrim--soft" aria-hidden />
        <div className="fc-wrap fc-name">
          <div className="fc-name__copy">
            <span className="fc-eyebrow fc-eyebrow--accent">03 · The name</span>
            <h2 id="fc-name" className="fc-h2 serif" data-lines>
              <span className="fc-line">
                <span>The gap has a name.</span>
              </span>
            </h2>
            <p className="fc-body fc-body--invert">
              When a trader hedges oil with a benchmark, the gap between the
              benchmark and the price they actually pay is called{" "}
              <em className="serif">basis</em>.
              <sup className="fc-fn">
                <a href="#sources">2</a>
              </sup>{" "}
              It&rsquo;s the risk standardization can&rsquo;t remove. GPUs, the
              commodity compute is supposed to have become, carry that gap too.
              This project is named after it, and it measures it.
            </p>
          </div>
          {/* No figures on this diagram. Its labels read "benchmark price"
              and "what you actually pay", and two same-day quotes are
              neither of those things — feeding them in would make the
              diagram state something false. It stays definitional. */}
          <div className="fc-name__diagram" data-stamp>
            <BracketDiagram />
          </div>
        </div>
      </section>

      {/* ——————————————————————————————— V · The reel (C4, C5, C6) */}
      <section className="fc-act fc-act--reel" aria-labelledby="fc-method">
        <Reel
          head={
            <div className="fc-wrap fc-reel__headrow">
              <div>
                <span className="fc-eyebrow fc-eyebrow--accent">
                  04 · The method
                </span>
                <h2 id="fc-method" className="fc-h2 fc-h2--invert serif">
                  Twice a day, we ask {providerWord} clouds the same question.
                </h2>
              </div>
              <p className="fc-reel__hint">
                Four frames.{" "}
                <span className="fc-reel__hint-desk">Keep scrolling.</span>
                <span className="fc-reel__hint-touch">Swipe the strip.</span>
              </p>
            </div>
          }
        >
          <ReelFrame index="01" label="Collect">
            <p className="fc-frame__lede serif">
              At 08:00 and 20:00 UTC we ask {providerWord} public catalogs the
              same question: what does an hour of this GPU cost right now?
            </p>
            <ul className="fc-frame__chips">
              {activeProviders.map((p) => (
                <li key={p}>{providerLabel(p)}</li>
              ))}
            </ul>
            <p className="fc-frame__foot">
              No private data and no paywalled feeds: only prices anyone could
              see.
            </p>
          </ReelFrame>

          <ReelFrame index="02" label="File">
            <p className="fc-frame__lede serif">
              Every answer is written down exactly as received, in full, and
              never edited again.
            </p>
            <p className="fc-frame__foot">
              Raw is sacred. Everything derived from it is disposable, and can be
              rebuilt from the file.
            </p>
            {totalOffers !== null ? (
              <div className="fc-frame__tally">
                <span className="serif">
                  <Tally value={totalOffers} grouping />
                </span>
                <span className="fc-frame__tally-label">answers on file</span>
              </div>
            ) : null}
          </ReelFrame>

          <ReelFrame index="03" label="Canonicalise">
            <p className="fc-frame__lede serif">
              Every cloud describes the same chip differently.
            </p>
            {/* Real recorded raw names, verified against raw_observations
                2026-08-03: vast reports "H100 SXM" (5,157 obs) and tensordock
                "H100 SXM5 80GB"; both canonicalize to h100_sxm_80gb.
                Quarantine Rule: never swap these for invented strings. */}
            <div className="fc-stencil">
              <span className="fc-stencil__raw" translate="no">&quot;H100 SXM&quot;</span>
              <span className="fc-stencil__raw" translate="no">&quot;H100 SXM5 80GB&quot;</span>
              <span className="fc-stencil__arrow" aria-hidden>
                ↓
              </span>
              <span className="fc-stencil__out" translate="no">{HERO_SKU}</span>
            </div>
            <p className="fc-frame__foot">
              A name that matches no rule is set aside, never guessed. Missing
              information stays <span className="fc-unknown">UNKNOWN</span> and
              stays visible.
            </p>
          </ReelFrame>

          <ReelFrame index="04" label="Subtract">
            <p className="fc-frame__lede serif">
              Then we subtract, one factor at a time, every reason the prices
              ought to differ.
            </p>
            <p className="fc-frame__foot">
              Where it is. How it&rsquo;s rented. Who sells it. What comes with
              it. What survives the subtraction is the finding.
            </p>
          </ReelFrame>
        </Reel>
      </section>

      {/* ——————————————————————————————— VI · Exhibit B */}
      <section className="fc-act fc-act--exhibit-b" aria-labelledby="fc-exhibit-b">
        <div className="fc-wrap">
          <div className="fc-exhibit__head">
            <div>
              <span className="fc-eyebrow fc-eyebrow--accent">
                05 · Exhibit B
              </span>
              <h2 id="fc-exhibit-b" className="fc-h2 serif" data-lines>
                <span className="fc-line">
                  <span>One day of quotes,</span>
                </span>
                <span className="fc-line">
                  <span>one canonical chip.</span>
                </span>
              </h2>
            </div>
            {quotes ? (
              <p className="fc-exhibit__meta">
                {quotes.day} · {quotes.lanes.length} catalogs
                <span className="fc-exhibit__meta-hint">
                  Hover, tap or arrow through a lane to read a quote.
                </span>
              </p>
            ) : null}
          </div>

          {quotes ? (
            <QuoteLanes
              exhibit={quotes}
              boundLow={bounds?.low ?? null}
              boundHigh={bounds?.high ?? null}
              sku={HERO_SKU}
            />
          ) : (
            <p className="fc-body">
              Today&rsquo;s quotes are momentarily unavailable. The{" "}
              <Link href="/dispersion">dispersion page</Link> carries the daily
              record.
            </p>
          )}
        </div>
      </section>

      {/* ——————————————————————————————— VII · Exhibit C (C7) */}
      <section className="fc-act fc-act--exhibit-c" aria-labelledby="fc-sheet">
        <div className="fc-wrap">
          <div className="fc-exhibit__head">
            <div>
              <span className="fc-eyebrow fc-eyebrow--accent">
                06 · Exhibit C
              </span>
              <h2 id="fc-sheet" className="fc-h2 serif" data-lines>
                <span className="fc-line">
                  <span>The settlement sheet.</span>
                </span>
              </h2>
              <p className="fc-lede">
                One hundred units of disagreement, filed against everything
                sellers disclose.
              </p>
            </div>
          </div>
        </div>

        {decomposition ? (
          <>
            <SettlementSheet
              decomposition={decomposition}
              population={population}
            />
            <div className="fc-wrap fc-sheet__after">
              <p className="fc-body">
                Where the machine is. How it&rsquo;s rented. Who sells it. What
                comes bundled with it. Everything observable, accounted for, and
                still a share of the price has no explanation.
              </p>
              <p className="fc-note">
                Change the order of the factors and the four credits move. The
                remainder does not. That is why the remainder is the headline.
                {residualRange
                  ? ` In market-priced segments it has ranged ${residualRange.minPct.toFixed(
                      0
                    )}% to ${residualRange.maxPct.toFixed(0)}% across the last ${
                      residualRange.days
                    } days, so basis risk is segment- and time-conditional.`
                  : " Basis risk is segment- and time-conditional."}
              </p>
            </div>
          </>
        ) : (
          <div className="fc-wrap">
            <p className="fc-body">
              The live decomposition is momentarily unavailable. The{" "}
              <Link href="/basis">Basis page</Link> holds the full ledger.
            </p>
          </div>
        )}
      </section>

      {/* ——————————————————————————————— VIII · Findings (C8, C9, C10) */}
      <section className="fc-act fc-act--findings" aria-labelledby="fc-findings">
        <div className="fc-wrap">
          <span className="fc-eyebrow fc-eyebrow--accent">
            07 · Findings of record
          </span>
          <h2 id="fc-findings" className="fc-h2 serif" data-lines>
            <span className="fc-line">
              <span>Three sheets that survived review.</span>
            </span>
          </h2>

          <FindingsFile>
            {/* Card 1 — the bound. Values interpolate from the artifact (A6). */}
            <article className="fc-card fc-card--dark">
              <header className="fc-card__head">
                <span>Subject · observable bound</span>
                <span className="fc-stamp">Bound, not victory</span>
              </header>
              <h3 className="fc-card__title serif">
                We built a richer model to kill the finding. It did worse.
              </h3>
              {anovaPct !== null && gbmPct !== null && gapPp !== null ? (
                <>
                  <p className="fc-card__body">
                    Forty-five features, day-based validation, and a leakage
                    guard that fails the run.
                  </p>
                  <div className="fc-bars">
                    <BoundBar
                      label="Four factors · in-sample"
                      value={anovaPct}
                      tone="pale"
                    />
                    <BoundBar
                      label="45 features · out-of-sample"
                      value={gbmPct}
                      tone="accent"
                    />
                    <div className="fc-bars__delta serif">
                      {/* A typographic minus, not a hyphen: this is a
                          quantity, and it is the point of the card. */}
                      Δ {gapPp < 0 ? "−" : "+"}
                      {Math.abs(gapPp).toFixed(1)}pp
                      <span>as of {trainedDate}</span>
                    </div>
                  </div>
                  <ShowMeHow label="Show the method">
                    <p>
                      Splits fall on ordered days, never rows.
                      {holdoutDays !== null
                        ? ` The final ${holdoutDays} days never enter selection.`
                        : ""}{" "}
                      Scoring is day-demeaned, so the model gets no credit for
                      knowing roughly what an H100 costs this month.
                      {permuted !== null
                        ? ` A permuted-target holdout above 0.05 kills the run; this one scored ${permuted.toFixed(
                            2
                          )}.`
                        : ""}{" "}
                      The gap bounds what observables can do. It says nothing
                      about what nobody publishes.
                    </p>
                  </ShowMeHow>
                </>
              ) : (
                <p className="fc-card__body">
                  Out-of-sample, the richer model still could not close the gap.
                  The{" "}
                  <Link href="/explainability">explainability page</Link> carries
                  the current bound.
                </p>
              )}
            </article>

            {/* Card 2 — host identity. */}
            <article className="fc-card fc-card--paper">
              <header className="fc-card__head">
                <span>Subject · host identity</span>
                <span className="fc-stamp fc-stamp--green">
                  Identity, not specs
                </span>
              </header>
              <h3 className="fc-card__title serif">
                The leftover is not noise. It sticks to specific machines.
              </h3>
              {icc !== null ? (
                <>
                  <div className="fc-figure">
                    <span className="fc-figure__value serif">
                      {icc.toFixed(2)}
                    </span>
                    <span className="fc-figure__label">
                      Intraclass correlation
                      {hostCount !== null ? ` · ${hostCount} hosts` : ""}
                      {iccThreshold !== null
                        ? ` · ${iccThreshold}-day tenure`
                        : ""}
                    </span>
                  </div>
                  <p className="fc-card__body">
                    Over half of what survives the subtraction tracks who the
                    host is, day after day. In a market of independent
                    operators, price is substantially a function of identity.
                    That is very nearly the opposite of a commodity.
                  </p>
                  {sensitivity.length > 0 ? (
                    <ShowMeHow label="Show the sensitivity">
                      <ul className="fc-sens">
                        {[...sensitivity]
                          .sort((a, b) => a.threshold - b.threshold)
                          .map((s) => (
                            <li key={s.threshold}>
                              <span>≥{s.threshold}d</span>
                              <span>{s.icc.toFixed(3)}</span>
                            </li>
                          ))}
                      </ul>
                      <p>
                        Published side by side, across every tenure threshold we
                        tried. No threshold was chosen for flattery.
                      </p>
                    </ShowMeHow>
                  ) : null}
                </>
              ) : (
                <p className="fc-card__body">
                  The host panel is momentarily unavailable. The{" "}
                  <Link href="/explainability">explainability page</Link> holds
                  it.
                </p>
              )}
            </article>

            {/* Card 3 — the moving series. Photographic plate. */}
            <article className="fc-card fc-card--plate">
              <div className="fc-card__plate">
                <PlateFrame plate={FINDING_ANALYST} depth={0.14} />
              </div>
              <div className="fc-card__inner">
                <header className="fc-card__head">
                  <span>Subject · the moving share</span>
                  <span className="fc-stamp">A range, not a favourite</span>
                </header>
                <h3 className="fc-card__title serif">
                  The number moves. We publish the range it moves in.
                </h3>
                {residualRange ? (
                  <>
                    <div className="fc-range">
                      <span className="serif">
                        {residualRange.minPct.toFixed(0)}%
                      </span>
                      <span className="fc-range__to" aria-hidden>
                        to
                      </span>
                      <span className="serif">
                        {residualRange.maxPct.toFixed(0)}%
                      </span>
                    </div>
                    <p className="fc-card__body">
                      Unexplained share in market-priced segments across the last{" "}
                      {residualRange.days} days. A single figure would be a
                      snapshot pretending to be a constant, so the file quotes
                      both ends and dates them.
                    </p>
                  </>
                ) : (
                  <p className="fc-card__body">
                    The daily series is momentarily unavailable. The{" "}
                    <Link href="/findings">findings page</Link> tracks it.
                  </p>
                )}
              </div>
            </article>
          </FindingsFile>

          <ul className="fc-limits">
            <li>
              <span>Limitation L1</span>Quoted prices, not transactions. This is
              a lower bound.
            </li>
            <li>
              <span>Limitation L2</span>A marketplace and a hyperscaler are not
              like-for-like populations.
            </li>
          </ul>
        </div>
      </section>

      {/* ——————————————————————————————— IX · Why it matters (C11–C14, C23, C25) */}
      <section className="fc-act fc-act--stakes" aria-labelledby="fc-stakes">
        <PlateFrame plate={STAKES_FLOOR} depth={0.18} showSlate={false} />
        <div className="fc-act__scrim fc-act__scrim--deep" aria-hidden />

        <div className="fc-wrap fc-stakes">
          <h2 id="fc-stakes" className="fc-h2 fc-h2--big serif" data-lines>
            <span className="fc-line">
              <span>Somebody is about to write</span>
            </span>
            <span className="fc-line">
              <span>the rules for how compute</span>
            </span>
            <span className="fc-line">
              <span>gets priced.</span>
            </span>
          </h2>
          <p className="fc-lede fc-lede--invert">
            You can&rsquo;t build financial plumbing on a price you can&rsquo;t
            explain. There is growing interest in treating AI compute like a
            commodity, with indexes, futures and contracts on top of it.
            <sup className="fc-fn">
              <a href="#sources">3</a>
            </sup>{" "}
            All of that assumes a GPU-hour has a knowable market price. That
            unexplained remainder is the risk any benchmark would silently
            absorb.
          </p>

          <ul className="fc-honesty" data-stamp data-stamp-group>
            <li>
              <h3>It&rsquo;s a study, not a product</h3>
              <p>
                Nothing for sale, no paid feed as a required input. Public
                quotes and a method you can rerun.
              </p>
            </li>
            <li>
              <h3>Every number has a receipt</h3>
              <p>
                Headline share, contributing offers, raw response, exact rules
                applied. Four clicks, no exceptions.
              </p>
            </li>
            <li>
              <h3>Honest about limits</h3>
              <p>
                One collection outage found, published, root-caused and turned
                into a standing alarm rather than smoothed away.
              </p>
            </li>
          </ul>

          <div className="fc-cta" data-stamp>
            <span className="fc-stamp fc-stamp--big">The file is open</span>
            <p className="serif fc-cta__line">
              It is not asking to be believed. It is asking to be checked.
            </p>
            <div className="fc-cta__buttons">
              <Link className="fc-btn" href="/findings">
                Open the dashboard
              </Link>
              <Link className="fc-btn fc-btn--ghost" href="/methodology">
                Read the methodology →
              </Link>
            </div>
          </div>

          {/* C23 — FINAL, verbatim (Raj, 2026-08-03). Do not edit this copy. */}
          <div className="fc-attrib">
            <p>
              I was just bored and curious. So here it is:{" "}
              <a
                href="https://github.com/RajTrivedi06/Basis"
                className="mono"
                rel="author"
              >
                github.com/RajTrivedi06/Basis
              </a>
            </p>
            <p className="serif fc-attrib__sig">— Raj</p>
          </div>

          <div id="sources" className="fc-sources">
            <span className="fc-eyebrow">Sources</span>
            {/* Hrefs resolve at the citations pass (claims-audit gate, design
                doc §5.1) — text-only until each link is verified real. */}
            <ol>
              <li>
                Hardware identity within a canonical SKU: normalization rules
                and variant separation — Basis methodology §3 (canonical
                schema).
              </li>
              <li>
                Commodity basis, standard definition — CME Group education
                materials on basis and hedging.
              </li>
              <li>
                Compute-as-commodity framing — Ornn AI public materials; the
                essays referenced in the original Basis proposal.
              </li>
            </ol>
            <p className="fc-note fc-note--invert">
              The GPU spread itself is our own live data.{" "}
              <Link href="/dispersion">See the dispersion page</Link>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function RegistryRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode | null;
}) {
  return (
    <div className="fc-registry__row">
      <dt>{label}</dt>
      <dd className="serif">{value ?? "—"}</dd>
    </div>
  );
}

function PriceTag({
  offer,
  plate,
  high = false,
}: {
  offer: HeroBounds["lowOffer"];
  plate: PlateSpec;
  high?: boolean;
}) {
  return (
    <article className={`fc-tag${high ? " fc-tag--high" : ""}`} data-stamp>
      <div className="fc-tag__media" aria-hidden>
        <picture>
          {plate.sources.map((source) => (
            <source
              key={source.srcSet}
              media={source.media}
              srcSet={source.srcSet}
              type="image/webp"
            />
          ))}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="fc-tag__img"
            src={plate.src}
            alt=""
            width={plate.width}
            height={plate.height}
            loading="lazy"
            decoding="async"
            style={
              {
                "--fc-pos": plate.position ?? "50% 50%",
              } as React.CSSProperties
            }
          />
        </picture>
      </div>
      <div className="fc-tag__foot">
        <div className="fc-tag__meta">
          <span className="fc-tag__sku" translate="no">
            {HERO_SKU}
          </span>
          <span className="fc-tag__where">
            {providerLabel(offer.provider)} · {regionLabel(offer.region)} ·{" "}
            {commitmentLabel(offer.commitment)}
          </span>
        </div>
        <div className="fc-tag__price serif">{usd(offer.price)}</div>
      </div>
    </article>
  );
}

/**
 * One bar of the bound comparison (design doc §6, Candidate A): both bars on
 * one 0–100% axis with the in-sample and out-of-sample labels required, so the
 * out-of-sample bar visibly falls short of the in-sample line.
 */
function BoundBar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "pale" | "accent";
}) {
  return (
    <div className="fc-bar">
      <div className="fc-bar__label">
        <span>{label}</span>
        <span className="fc-bar__value">{value.toFixed(1)}%</span>
      </div>
      <div className="fc-bar__track">
        <span
          className={`fc-bar__fill fc-bar__fill--${tone}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
          data-grow
        />
      </div>
    </div>
  );
}
