"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BulletinAnnex } from "./BulletinAnnex";
import { BulletinFile } from "./BulletinFile";
import { BulletinMasthead } from "./BulletinMasthead";
import { BulletinPatterns } from "./BulletinPatterns";
import { BulletinSidebar } from "./BulletinSidebar";
import { BulletinStamp } from "./BulletinStamp";
import { Redaction } from "./Redaction";
import { ExhibitADots } from "./exhibits/ExhibitADots";
import { ExhibitBCustody } from "./exhibits/ExhibitBCustody";
import { ExhibitCTable } from "./exhibits/ExhibitCTable";
import { ExhibitDIqr } from "./exhibits/ExhibitDIqr";
import { ExhibitELedger } from "./exhibits/ExhibitELedger";
import { ExhibitFSeries } from "./exhibits/ExhibitFSeries";
import {
  DEFAULT_ORDER,
  DEFAULT_SKU,
  buildBulletinView,
  moveFactor,
  type FactorKey,
  type SkuId,
} from "./sim/bulletinSim";
import "./bulletin.css";

export function MethodologyBulletin() {
  const [sku, setSku] = useState<SkuId>(DEFAULT_SKU);
  const [order, setOrder] = useState<FactorKey[]>(DEFAULT_ORDER);
  const [catalogs, setCatalogs] = useState(false);

  const view = useMemo(
    () => buildBulletinView(sku, order, catalogs),
    [sku, order, catalogs],
  );

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const els = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal], [data-stamp]"),
    );
    const io = new IntersectionObserver(
      (ents) => {
        ents.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target as HTMLElement;
          el.classList.add("is-in");
          io.unobserve(el);
        });
      },
      { threshold: 0.15 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="bulletin-page fade-up">
      <a className="bulletin-skip" href="#file-00">
        Skip to the report
      </a>

      <BulletinPatterns />
      <BulletinMasthead />

      <div className="bulletin-inner">
        <main>
          {/* —— Front page —— */}
          <div className="bull-front">
            <article id="file-00" className="bull-front__main">
              <div className="bull-file__head">
                <div className="bull-kicker">The question</div>
                <div className="bull-file-no">FILE NO. 00-1173-M/00</div>
              </div>
              <h2 className="bull-file__title">
                One chip, one day: quoted prices found in wide disagreement
              </h2>
              <div className="bull-byline">
                By staff correspondent — Langley, Va. —
              </div>
              <p className="bull-prose">
                <span className="bull-drop">O</span>n the day of this edition,
                field stations recorded{" "}
                <span className="bull-tok">{view.n}</span> public quoted prices
                for one exactly-specified machine — the {view.skuLabel} — every
                quote stated in dollars per GPU per hour. The cheapest asked{" "}
                <span className="bull-tok">{view.minP}</span>; the dearest,{" "}
                <span className="bull-tok">{view.maxP}</span> — a spread of{" "}
                <span className="bull-tok">{view.spread}</span> for hardware
                that is, by specification, the same.
              </p>
              <p className="bull-prose">
                These are simultaneous quotes on a single UTC day — not prices
                moving over time. The disagreement is the subject of this
                bulletin: how much of it can be explained by observable causes,
                and how much cannot.
              </p>
              <ExhibitADots view={view} />
              <BulletinAnnex summary="Inter-office memorandum — scope of the comparison (technical annex)">
                <p>
                  1. UNIT. Price is USD per GPU per hour. Multi-GPU bundles are
                  divided out before anything else happens.
                </p>
                <p>
                  2. ONE SKU AT A TIME. SXM, PCIe, and NVL are different SKUs;
                  40GB and 80GB are different SKUs. No cross-SKU pooling exists
                  anywhere in the method.
                </p>
                <p>
                  3. ONE UTC DAY AT A TIME. The comparison is purely
                  cross-sectional. THE MEASUREMENT IS DISAGREEMENT BETWEEN
                  SIMULTANEOUS QUOTES — NOT PRICE VOLATILITY, which concerns
                  movement over time.
                </p>
                <p>
                  4. The exhibit&apos;s data table: n = {view.n}, min{" "}
                  {view.minP}, p25 {view.p25P}, median {view.medP}, p75{" "}
                  {view.p75P}, max {view.maxP}.{" "}
                  <span className="bull-sim">[SIM]</span>
                </p>
              </BulletinAnnex>
            </article>

            <BulletinSidebar
              sku={sku}
              marketPct={view.marketPct}
              onPickSku={setSku}
            />
          </div>

          {/* —— 01 Collection —— */}
          <BulletinFile
            id="file-01"
            kicker="Collection & custody"
            fileNo="FILE NO. 00-1173-M/01"
            title="Field stations record every answer; originals sealed, never edited"
            byline="From the records division — Langley, Va. —"
          >
            <div className="bull-cols">
              <p className="bull-prose">
                Twice daily, at 08:00 and 20:00 hours UTC, stations operating{" "}
                <Redaction label="redacted">
                  from two commercial cloud regions
                </Redaction>{" "}
                query five providers and write down every answer exactly as
                given. Should a provider fail to answer, the cycle proceeds
                without it — the record shows holes, never fabrications.
              </p>
              <p className="bull-prose">
                Each original response is sealed in full into the central file,
                where it may never be edited or destroyed. Every later judgment —
                every translation, every calculation — is a disposable copy that
                can be re-derived from the sealed originals. This, officials
                note, is the answer to the question every reader should ask:{" "}
                <em>how do we know you didn&apos;t tune this?</em> Because the
                evidence cannot be touched, any opinion about it can be safely
                revised in public.
              </p>
              <p className="bull-prose">
                The public record counts only prices gathered by this regular
                twice-daily routine. Historical prices back-filled by other means
                exist in the archive but are kept out of the series, because
                mixing two collection mechanisms manufactures changes where none
                occurred. The series answers one question:{" "}
                <em>
                  what does the market look like, sampled the same way every
                  day?
                </em>
              </p>
            </div>
            <ExhibitBCustody view={view} />
            <BulletinAnnex summary="Inter-office memorandum — collection particulars (technical annex)">
              <p>
                1. STATIONS. Five collectors: Vast.ai (REST), RunPod (GraphQL),
                AWS EC2 Spot (boto3), Azure retail catalog, GCP catalog. Timer
                fires 08:00 and 20:00 UTC, persistent, with a randomized delay. A
                collector that fails returns an empty list; one outage cannot
                fail a cycle.
              </p>
              <p>
                2. THE DUAL QUERY. Vast is asked twice per run — once for
                on-demand, once for interruptible bids. The payload&apos;s
                is_bid field reads FALSE on every offer of BOTH queries
                (verified across 315,685 stored rows), so commitment type is
                derived from WHICH ENDPOINT ANSWERED, not from the data. A
                machine listed by both queries yields two observations at two
                prices: two distinct products, not duplicates.
              </p>
              <p>
                3. THE CAP. Since 2026-06-23 unauthenticated Vast responses are
                silently capped at the 64 cheapest offers, structurally hiding
                the premium tier. Collection is authenticated.
              </p>
              <p>
                4. CUSTODY. raw_observations stores the provider&apos;s complete
                response (~95 fields per Vast offer) as write-once JSONB plus
                five extracted columns. Derived tables (canonical_offers onward)
                are deleted and regenerated whenever the rules change.
              </p>
              <p>
                5. POPULATION RULE (ADR-0007). Analytics reads only
                cron-collected rows; rows flagged as backfill are excluded.
                Precedent: a 90-day AWS backfill made pre-boundary days carry
                ~57 rows and post-boundary days ~30 — pooled, this produced an
                apparent decline that was purely a change in who was in the
                sample. Caught before publication.
              </p>
            </BulletinAnnex>
          </BulletinFile>

          {/* —— 02 Nomenclature —— */}
          <BulletinFile
            id="file-02"
            kicker="Nomenclature"
            fileNo="FILE NO. 00-1173-M/02"
            title="Five dialects, one vocabulary; unmatched names set aside, never guessed"
            byline="By the translation bureau — Langley, Va. —"
          >
            <div className="bull-split">
              <div>
                <p className="bull-prose">
                  Every seller describes the same chip differently. Before prices
                  can be compared, the names must be translated into one shared
                  vocabulary — and the Bureau&apos;s rules are strict: an
                  exact-match dictionary, hand-written entry by entry. A name not
                  in the book is <strong>set aside and counted</strong>, never
                  guessed at. No fuzzy matching, no tolerance for near-misses.
                </p>
                <p className="bull-prose">
                  Where information is missing, it stays visibly missing: the
                  label UNKNOWN enters the analysis as a real group of its own,
                  so that no observation is quietly dropped and no gap is
                  laundered into an answer. Meaningful hardware differences are
                  never collapsed — different form factors and memory sizes
                  remain different subjects, permanently.
                </p>
                <p className="bull-prose">
                  Every translation keeps its paper trail. For any sealed
                  original, the Bureau can replay exactly which rule fired, what
                  the source value was, and what it became — a trail the
                  write-path is structurally forbidden from touching.
                </p>
              </div>
              <ExhibitCTable />
            </div>
            <BulletinAnnex summary="Inter-office memorandum — the four rule modules (technical annex)">
              <p>
                1. GPU SKU. Exact-string dictionary, ~190 hand-written entries →
                96 canonical SKUs, format {"{model}_{form_factor}_{vram}gb"}.
                SXM / PCIe / NVL are different SKUs; 40GB / 80GB are different
                SKUs. Unmatched → skipped and counted (skipped_unknown_gpu). No
                fuzzy matching, no case folding.
              </p>
              <p>
                2. COMMITMENT. Eight canonical values: on_demand, spot,
                reserved_1w/1m/3m/6m/1y/3y. Alternates map (interruptible, bid,
                preemptible → spot). Unknown non-null strings pass through
                unchanged as their own group. DISCLOSURE: a null commitment is
                coerced to on_demand — the one inference in the layer.
              </p>
              <p>
                3. REGION. Per-provider lookup maps → (country, state, city).
                ONLY COUNTRY enters the model; state and city are stored, unused.
                RunPod reports no region → UNKNOWN.
              </p>
              <p>
                4. BUNDLE. vCPU / RAM / storage extracted for marketplaces only
                (Vast, TensorDock); hyperscalers and RunPod contribute none →
                UNKNOWN. Bundle sits LAST in the fixed order, so its
                provider-shaped missingness is absorbed by the provider term
                before bundle takes its turn.
              </p>
              <p>
                5. PROVENANCE. Each module carries a parallel explain_* trail
                (matched key, transformation, source value). An AST-level test
                fails the build if the write path references any explain
                identifier. Endpoint: /api/raw-observation/{"{id}"}/explain.
              </p>
            </BulletinAnnex>
          </BulletinFile>

          {/* —— 03 Dispersion —— */}
          <BulletinFile
            id="file-03"
            kicker="Dispersion"
            fileNo="FILE NO. 00-1173-M/03"
            title="A day's quotes reduced to three numbers"
            byline="By the statistics desk — Langley, Va. —"
          >
            <div className="bull-cols">
              <p className="bull-prose">
                For each day and each chip, the cloud of quotes is reduced to
                three figures: the middle price, and the range within which the
                middle half of all quotes falls. Averages are never used — one
                junk listing, priced by a seller who expects no taker, would drag
                an average to a price at which no buyer could actually transact.
              </p>
              <p className="bull-prose">
                Days too thin to summarize are not summarized: fewer than three
                quotes, and the Bureau declines to report rather than pretend.
                What is not known is not stated.
              </p>
            </div>
            <ExhibitDIqr view={view} />
            <BulletinAnnex summary="Inter-office memorandum — dispersion particulars (technical annex)">
              <p>
                1. Grouped twice: per (date, sku) across all providers, and per
                (date, sku, provider). Outputs: observation_count, median_price,
                p25_price, p75_price.
              </p>
              <p>
                2. MINIMUM 3 OBSERVATIONS per bucket, else the bucket is skipped
                entirely.
              </p>
              <p>
                3. Percentiles, never mean ± sd: quote distributions are
                asymmetric, and a single mispriced line would average the price
                somewhere no buyer could transact.
              </p>
            </BulletinAnnex>
          </BulletinFile>

          {/* —— 04 Subtraction —— */}
          <BulletinFile
            id="file-04"
            kicker="The decomposition"
            fileNo="FILE NO. 00-1173-M/04"
            title="Four causes removed in fixed order; the remainder refuses to be filed"
          >
            <div className="bull-file__toolbar">
              <div className="bull-byline" style={{ marginBottom: 0 }}>
                By staff correspondent — Langley, Va. —
              </div>
              <div className="bull-note" aria-hidden="true">
                the leftover is the finding — R.T.
              </div>
            </div>
            <div className="bull-cols">
              <p className="bull-prose">
                Take all of the day&apos;s disagreement — one hundred percent of
                it — and subtract, one cause at a time, everything observable:{" "}
                <strong>where</strong> the machine is, <strong>how</strong> it is
                rented, <strong>who</strong> sells it, and <strong>what</strong>{" "}
                comes bundled. Each cause is credited only with what it explains
                after the causes before it have had their turn. Whatever is still
                standing at the end is the finding.
              </p>
              <p className="bull-prose">
                The order of subtraction changes each cause&apos;s share of the
                credit. It does not — cannot — change the remainder. Readers are
                invited to verify this themselves in Exhibit E: reorder the
                ledger and watch the shares move while the remainder stands
                still. That invariance is the entire reason the remainder, and
                not the causes, carries the headline.
              </p>
            </div>
            <ExhibitELedger
              view={view}
              onMove={(i, d) => setOrder((o) => moveFactor(o, i, d))}
            />
            <BulletinAnnex summary="Inter-office memorandum — the calculation in full (technical annex)">
              <pre>{`Per (date, gpu_sku) with n ≥ 5:
  y        = ln(price_usd_per_hour)
  total_ss = Σ (yᵢ − ȳ)²
  for factor in (region, commitment, provider, bundle):  # fixed order
      keys = factor values, NULL → "UNKNOWN"
      if distinct(keys) < 2: attribute 0; continue
      ss_within = Σ (yᵢ − mean within CROSS-PRODUCT of prior keys)²
      attributed[factor] = max(0, previous_ss_within − ss_within)
  residual = max(0, total_ss − Σ attributed)
  # each component / (n − 1) to become a variance`}</pre>
              <p>
                SEVEN STANDING DECISIONS: (1) LOG PRICES — ratios, not dollar
                gaps. (2) SEQUENTIAL, NOT SIMULTANEOUS — conditioning is on the
                cross-product of all prior factors. (3) FIXED ORDER,
                most-exogenous → most-internal: region → commitment → provider →
                bundle. (4) ORDER CHANGES THE FACTORS, NEVER THE RESIDUAL. (5)
                NULL IS A GROUP — UNKNOWN participates as a real level. (6) A
                factor with fewer than 2 distinct values contributes exactly
                zero. (7) max(0,·) flooring — numerically safe.
              </p>
              <p>
                The exhibit above runs this exact arithmetic, in the
                reader&apos;s browser, on the day&apos;s simulated panel. In
                production it runs on the live panel and every share can be
                walked back to the contributing offers.
              </p>
            </BulletinAnnex>
          </BulletinFile>

          {/* —— 05 Finding —— */}
          <BulletinFile
            id="file-05"
            kicker="The finding"
            fileNo="FILE NO. 00-1173-M/05"
            title="Same method, same days, two answers: the population is part of the number"
            byline="By staff correspondent — Langley, Va. —"
          >
            <div className="bull-cols">
              <p className="bull-prose">
                Two of the five providers publish administered list catalogs —
                one posted price per machine type, revised rarely. Such quotes
                are explainable <em>by construction</em>: where the machine is
                and how it is rented account for nearly everything. Pool them
                with marketplace quotes and the measured remainder collapses
                mechanically, with nothing in the market having changed.
              </p>
              <p className="bull-prose">
                Operate the switch in Exhibit F and perform the experiment
                yourself. The verdict, in the Bureau&apos;s words:{" "}
                <strong>
                  a benchmark that quotes the pooled figure is reporting the
                  composition of its sample, not the state of the market.
                </strong>{" "}
                The remainder is not a constant — it is a property of who is
                counted. That dependence is not a caveat on the finding. It{" "}
                <em>is</em> the finding.
              </p>
            </div>
            <ExhibitFSeries
              view={view}
              catalogs={catalogs}
              onToggleCatalogs={() => setCatalogs((c) => !c)}
            />
            <div className="bull-briefs">
              <div className="bull-brief">
                <div className="bull-kicker">
                  Wire brief — the counter-analysis
                </div>
                <h3>
                  Rich model fails to beat four coarse factors, audit finds
                </h3>
                <p>
                  To answer the objection that the remainder is merely the
                  Bureau&apos;s own ignorance, a forty-five-feature model was
                  trained on every observable a seller will disclose, under
                  strict out-of-sample rules and a leakage guard that fails the
                  run outright. Tested honestly, it explained <em>less</em> than
                  the four factors. The gap is negative, and is published.{" "}
                  <Link href="/explainability">
                    Consult the counter-analysis file.
                  </Link>
                </p>
              </div>
              <div className="bull-brief">
                <div className="bull-kicker">
                  Wire brief — the anatomy of the leftover
                </div>
                <h3>
                  Leftover sticks to specific machines — identity, not
                  specification
                </h3>
                <p>
                  In the one marketplace where machines can be tracked across
                  days, over half of the within-day leftover attaches to the same
                  specific hosts, day after day (ICC ≈ 0.55, published with
                  sensitivity checks at three tenure thresholds). Whatever the
                  remainder is, it is not random noise.{" "}
                  <Link href="/explainability">See the host-identity file.</Link>
                </p>
              </div>
            </div>
            <BulletinAnnex summary="Inter-office memorandum — populations & the counter-analysis (technical annex)">
              <p>
                1. MARKET-PRICED is defined as the panel excluding the
                administered catalogs (azure, gcp). The exclusion RECOMPUTES the
                decomposition through the same production function the nightly
                job uses — it does not filter a cached result. Endpoint:
                /api/basis/{"{sku}"}/timeseries?exclude_providers=azure,gcp.
              </p>
              <p>
                2. THE BOUND. XGBoost on ~45 observable features, day-based
                expanding-window CV, a 10-day untouched holdout, a hard-failing
                permuted-target leakage guard, and day-demeaned R² for parity
                with the ANOVA. Result: negative gap — the rich model, tested
                out-of-sample, explains less than four coarse factors claimed
                in-sample.
              </p>
              <p>
                3. HOST ICC ≈ 0.55, Vast on-demand panel only, ≥10-day tenure
                primary, recomputed at ≥5 and ≥20 with a 0.15 swing alarm. It
                says the effect is persistent; it does not say why.
              </p>
            </BulletinAnnex>
          </BulletinFile>

          {/* —— 06 Limitations —— */}
          <BulletinFile
            id="file-06"
            kicker="Limitations — published in full"
            fileNo="FILE NO. 00-1173-M/06"
            title="What the Bureau cannot see"
          >
            <div className="bull-file__toolbar">
              <div className="bull-byline" style={{ marginBottom: 0 }}>
                From the office of the inspector — these run open, never folded
                away. —
              </div>
              <BulletinStamp>Read with care</BulletinStamp>
              <div
                className="bull-note"
                aria-hidden="true"
                style={{ marginLeft: "auto", transform: "rotate(2deg)" }}
              >
                print this section in full. no exceptions.
              </div>
            </div>
            <div className="bull-limits">
              <Limit
                num="L1 — Quotes, not transactions"
                body="Every figure rests on quoted list prices. Real transactions likely compress the disagreement; by how much is unobservable from public data. The remainder is therefore a lower-bound-style claim, not a settled market fact."
              />
              <Limit
                num="L2 — Unlike generators"
                body="A marketplace of thousands of independent sellers and a catalog with a handful of posted lines are not like-for-like sources. Selection differs between them in ways the method does not model."
              />
              <Limit
                num="L3 — Coverage"
                body="The record begins in April 2026 and runs on scheduled equipment (EC2 systemd timers). Days a provider failed to answer are holes, and stay holes — they are never back-filled into the public series."
              />
              <Limit
                num="L4 — What is left in, by design"
                body="Reliability scores, interconnect, datacenter tier and other continuous qualities are deliberately not subtracted: normalizing them would require subjective mappings that are more opinion than measurement. They remain inside the remainder."
              />
              <Limit
                num="L5 — No error bars"
                body="Every figure is a point estimate. A five-quote day and a five-hundred-quote day are stored and plotted identically; no confidence interval is published anywhere. This is the objection a hostile reviewer should lead with, and the Bureau prints it unprompted."
              />
              <Limit
                num="L6 — One loud witness"
                body="One marketplace has supplied 68–75% of all filed offers. Under equal weighting, the remainder partly measures that single marketplace's internal heterogeneity wearing the market's name."
              />
              <Limit
                num="L7 — Bundle is marketplace-only"
                body="The bundled vCPU / RAM / storage factor is measured for marketplace listings only; catalog providers contribute none and are filed UNKNOWN. Its position last in the order limits, but does not remove, the consequence."
              />
              <Limit
                num="And what the remainder is not"
                body="Not volatility. Not arbitrage. Not overpricing, nor a savings estimate, nor a claim that any two offers are perfectly substitutable. It is unexplained cross-sectional disagreement within one SKU, one day, one stated population — nothing more is asserted."
                emphasis
              />
            </div>
          </BulletinFile>

          {/* —— Letters —— */}
          <section
            id="letters"
            className="bull-file bull-letters bull-reveal"
            data-reveal
          >
            <div className="bull-kicker">Letters to the editor</div>
            <h2 className="bull-file__title">
              Readers ask; the desk replies
            </h2>
            <div className="bull-cols">
              <div className="bull-letter">
                <p className="bull-letter__q">
                  &ldquo;Sirs — If the same chip is quoted at twice the price
                  across town, has your Bureau not discovered free money?&rdquo;
                  — A READER,{" "}
                  <Redaction label="redacted">STATION W</Redaction>
                </p>
                <p className="bull-letter__a">
                  <strong>The Desk replies:</strong> No. Unexplained is not
                  exploitable. Two offers at different prices may not be
                  substitutable for reasons the record cannot see — availability,
                  latency, contract terms, trust. The record shows disagreement;
                  it does not show a trade.
                </p>
              </div>
              <div className="bull-letter">
                <p className="bull-letter__q">
                  &ldquo;Sirs — Is your &lsquo;remainder&rsquo; not simply prices
                  bouncing about, as prices do?&rdquo;
                </p>
                <p className="bull-letter__a">
                  <strong>The Desk replies:</strong> No. Every comparison is
                  between quotes recorded on the same day. The remainder measures
                  simultaneous disagreement, never movement over time — and it is
                  neither an overpricing charge nor a savings estimate. It is the
                  portion of same-day disagreement that survives every observable
                  explanation.
                </p>
              </div>
            </div>
          </section>

          {/* —— Subscribe —— */}
          <section
            id="subscribe"
            className="bull-subscribe bull-reveal"
            data-reveal
          >
            <div className="bull-subscribe__frame">
              <div className="bull-subscribe__inner">
                <div className="bull-subscribe__cut" aria-hidden="true">
                  ✂
                </div>
                <div className="bull-subscribe__copy">
                  <div className="bull-subscribe__title">
                    Subscribe to the bulletin
                  </div>
                  <p>
                    The Bureau does not ask to be believed; it asks to be
                    checked. Every figure in this edition walks back — through
                    the ledger, to the contributing offers, to the raw wire a
                    provider actually returned, to the exact rule applied. No
                    accounts. No fees. Public data only.
                  </p>
                </div>
                <div className="bull-subscribe__list">
                  ☐{" "}
                  <Link href="/basis">
                    Inspect the evidence — the settlement ledger
                  </Link>
                  <br />
                  ☐{" "}
                  <Link href="/explainability">
                    Read the counter-analysis — bound &amp; host file
                  </Link>
                  <br />
                  ☐{" "}
                  <Link href="/dispersion">
                    Consult the daily dispersion record
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="bull-colo">
          <span>THE INTERNAL BULLETIN — VOL. XXIV, NO. 3 — FILE 00-1173-M</span>
          <span>NOT A PRICE AGGREGATOR · NOT A DERIVATIVES ENGINE</span>
          <span>EVERY FIGURE: VALUE · POPULATION · DATE · SOURCE</span>
        </footer>
      </div>

      <div className="bull-colo-bar">
        <span className="bull-classbar__declass">
          <span className="bull-classbar__star">★</span> DECLASSIFIED —
          AUTHORIZED FOR PUBLIC RELEASE{" "}
          <span className="bull-classbar__star">★</span>
        </span>
      </div>
    </div>
  );
}

function Limit({
  num,
  body,
  emphasis,
}: {
  num: string;
  body: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`bull-limit${emphasis ? " bull-limit--emphasis" : ""}`}>
      <div className="bull-limit__num">{num}</div>
      <p className="bull-limit__body">{body}</p>
    </div>
  );
}
