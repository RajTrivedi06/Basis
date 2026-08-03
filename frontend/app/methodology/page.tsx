import { Suspense } from "react";
import { ShowMeHow } from "@/components/disclosure/TwoLayer";
import { GlossaryTerm } from "@/components/glossary/GlossaryTerm";
import { MethodologyChrome, type TocItem } from "./MethodologyChrome";
import { MethodologyHero } from "./MethodologyHero";
import { ModelChain } from "./ModelChain";
import { PipelineDiagram } from "./PipelineDiagram";
import { PooledExhibit } from "./PooledExhibit";
import { ResidualReveal } from "./ResidualReveal";
import { Reveal } from "./Reveal";
import { MethodologyComparisonSection } from "./MethodologyComparisonSection";

const TOC: TocItem[] = [
  { id: "premise", num: "01", title: "Premise" },
  { id: "collection", num: "02", title: "Data collection" },
  { id: "schema", num: "03", title: "Canonical schema" },
  { id: "dispersion", num: "04", title: "Dispersion metrics" },
  { id: "decomposition", num: "05", title: "Basis decomposition" },
  { id: "limitations", num: "06", title: "Limitations" },
  { id: "residual", num: "07", title: "What the residual means" },
  { id: "comparison", num: "08", title: "Comparison" },
  { id: "pooling", num: "09", title: "Why pooling misleads" },
];

const LIMITATIONS: { num: string; title: string; body: string }[] = [
  {
    num: "L1",
    title: "Quoted, not transacted",
    body: "Every figure is a public list price. Enterprise-negotiated rates are not visible without access to a transaction benchmark such as Ornn's OCPI.",
  },
  {
    num: "L2",
    title: "Selection bias",
    body: "Marketplaces like Vast.ai list many independent sellers; hyperscalers list a small number of instance types. These are not like-for-like data generators.",
  },
  {
    num: "L3",
    title: "Temporal coverage",
    body: "Collection currently runs on laptop-hosted cron. Gaps in the time series are possible and are not back-filled — only forward observations count.",
  },
  {
    num: "L4",
    title: "Continuous factors",
    body: "Reliability scores, interconnect type, and datacenter tier are left in the residual by design. Conservative normalization avoids price-adjusting for fields we cannot audit.",
  },
];

export default function MethodologyPage() {
  return (
    <div className="fade-up">
      <MethodologyHero />

      <div
        id="meth-article"
        className="page-wide relative grid grid-cols-1 gap-12 pt-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16 xl:gap-24"
      >
        <div className="hidden lg:block">
          <MethodologyChrome items={TOC} />
        </div>

        <article className="min-w-0 max-w-[960px]">
          <section id="premise" className="meth-section">
            <Reveal className="meth-section__head" delay={40}>
              <span className="meth-section__index">01 · Premise</span>
              <h2 className="meth-section__title">
                A variance-accounting study, not a price index.
              </h2>
              <p className="meth-section__lede">
                Basis is a public-data study measuring how fungible GPU compute
                really is across cloud providers. It collects quoted prices,
                normalizes them into a canonical schema, and decomposes
                observed price variance into observable factors and a
                residual. The residual is the headline finding.
              </p>
            </Reveal>

            {/* Design doc §10 C16 — final copy, reproduced verbatim. */}
            <Reveal delay={140}>
              <blockquote className="meth-quote">
                <p>
                  If a benchmark designer can&rsquo;t tell you which adjustments
                  produced the headline number, the headline number is doing the
                  wrong job.
                </p>
              </blockquote>
            </Reveal>

            <Reveal className="meth-section__body" delay={180}>
              <ShowMeHow>
                <p>
                  The entire pipeline is rule-based and traceable. Every
                  attribution can be regenerated from the original provider
                  response, and every adjustment is small enough to argue with.
                  Interpretability is not a polish — it is the claim.
                </p>
                <p>
                  Three numbers carry the study: how far apart quoted prices sit
                  on a given day, how much of that spread named factors account
                  for, and what is left over. The last one is the{" "}
                  <GlossaryTerm term="residual">residual</GlossaryTerm>, and
                  every page here exists to keep it honest.
                </p>
              </ShowMeHow>
            </Reveal>
          </section>

          <section id="collection" className="meth-section">
            <Reveal className="meth-section__head" delay={40}>
              <span className="meth-section__index">02 · Data collection</span>
              <h2 className="meth-section__title">
                Five providers, <em>twice daily</em>, JSONB forever.
              </h2>
              <p className="meth-section__lede">
                Vast.ai (REST), RunPod (GraphQL), AWS EC2 Spot (boto3), and the
                Azure and GCP list catalogs are collected on a fixed 2× / day
                cadence. TensorDock was retired 2026-06-12. Lambda Labs was
                considered but dropped — its free API key now requires a
                payment method on file, which violates the study&apos;s
                zero-data-cost constraint.
              </p>
            </Reveal>

            <Reveal className="meth-section__body" delay={180}>
              <ShowMeHow>
                <p>
                  Every collector writes its full provider response to{" "}
                  <span className="tok">raw_observations</span> as a JSONB blob.
                  Raw rows are immutable — never updated, never deleted — so the
                  normalized layer can always be regenerated from source truth.
                </p>
                <p>
                  Two runs a day is a deliberate floor, not a limit: it is often
                  enough to catch a repricing, and slow enough that every quote
                  in the corpus can be traced back to a single recorded
                  response.
                </p>
              </ShowMeHow>
            </Reveal>

            <div className="mt-10">
              <PipelineDiagram />
            </div>
          </section>

          <section id="schema" className="meth-section">
            <Reveal className="meth-section__head" delay={40}>
              <span className="meth-section__index">
                03 · Canonical schema
              </span>
              <h2 className="meth-section__title">
                Conservative normalization preserves the residual.
              </h2>
              <p className="meth-section__lede">
                The normalization layer projects each raw observation into a{" "}
                <span className="tok">canonical_offer</span> row with
                standardized fields. Unknown values stay unknown.
              </p>
            </Reveal>

            <Reveal className="meth-section__body" delay={180}>
              <ShowMeHow>
                <p>
                  Each canonical row carries a canonical GPU SKU (for example{" "}
                  <span className="tok">h100_sxm_80gb</span>), a canonical
                  commitment type (<span className="tok">on_demand</span>,{" "}
                  <GlossaryTerm term="spot">
                    <span className="tok">spot</span>
                  </GlossaryTerm>
                  , or <span className="tok">reserved_*</span>), country /
                  state / city region, and the bundled vCPU/RAM/storage that
                  travelled with the offer.
                </p>
                <p>
                  Unknown GPU names are skipped and logged, not guessed. Missing
                  factor values remain a distinct{" "}
                  <span className="pill-unknown">UNKNOWN</span> group rather
                  than being imputed away. Conservative normalization preserves
                  the residual instead of laundering ambiguity into &ldquo;region&rdquo;
                  or &ldquo;bundle.&rdquo;
                </p>
              </ShowMeHow>
            </Reveal>
          </section>

          <section id="dispersion" className="meth-section">
            <Reveal className="meth-section__head" delay={40}>
              <span className="meth-section__index">
                04 · Dispersion metrics
              </span>
              <h2 className="meth-section__title">
                Median and IQR, market-wide and per provider.
              </h2>
              <p className="meth-section__lede">
                For each <span className="tok">(date, gpu_sku)</span> pair with
                at least three offers, Basis computes median, 25th percentile,
                75th percentile, and observation count — both across all
                providers and per-provider.
              </p>
            </Reveal>

            <Reveal className="meth-section__body" delay={180}>
              <ShowMeHow>
                <p>
                  These daily aggregates live in{" "}
                  <span className="tok">daily_aggregates</span> and power the
                  time-series pages. Anything below three offers is held out:
                  noise from thin samples is precisely the kind of confidence
                  Basis is built to resist.
                </p>
              </ShowMeHow>
            </Reveal>
          </section>

          <section id="decomposition" className="meth-section">
            <Reveal className="meth-section__head" delay={40}>
              <span className="meth-section__index">
                05 · Basis decomposition
              </span>
              <h2 className="meth-section__title">
                Sequential ANOVA, in <em>fixed model order</em>.
              </h2>
              <p className="meth-section__lede">
                For each <span className="tok">(date, gpu_sku)</span> with at
                least five offers, Basis runs a sequential ANOVA on
                log-prices — a{" "}
                <GlossaryTerm term="decomposition">decomposition</GlossaryTerm>{" "}
                in fixed model order that renders the same way everywhere on the
                site:
              </p>
            </Reveal>

            <div className="mt-8">
              <ModelChain />
            </div>

            <Reveal className="meth-section__body mt-10" delay={140}>
              <ShowMeHow>
                <p>
                  Each factor&apos;s attribution is the additional
                  sum-of-squares explained after conditioning on all prior
                  factors. The residual is{" "}
                  <span className="tok">total_variance − Σ attributions</span>.
                </p>
                <p>
                  <span className="ink">Order dependence.</span> Sequential
                  ANOVA is order-dependent: a different order redistributes
                  factor attributions, but leaves the residual unchanged. That
                  is why the Basis page and the comparison panel at the bottom
                  both render in model order rather than prototype order.
                </p>
                <p>
                  <span className="ink">Why log-prices.</span> Price ratios, not
                  absolute differences, are the meaningful fungibility metric.
                  A 2× price multiplier at $1/hr vs $2/hr represents the same
                  fungibility gap as 2× at $2/hr vs $4/hr; they should not be
                  conflated in absolute-variance terms.
                </p>
              </ShowMeHow>
            </Reveal>
          </section>

          <section id="limitations" className="meth-section">
            <Reveal className="meth-section__head" delay={40}>
              <span className="meth-section__index">06 · Limitations</span>
              <h2 className="meth-section__title">
                What this measurement cannot see.
              </h2>
              <p className="meth-section__lede">
                These four constraints set the scope of every claim Basis
                makes. They are stated up front because pretending they are
                not present is the failure mode the study is built to avoid.
              </p>
            </Reveal>

            <div className="mt-8 limits-grid">
              {LIMITATIONS.map((lim, idx) => (
                <Reveal key={lim.num} delay={idx * 90}>
                  <div className="limit-card">
                    <div className="limit-card__num">{lim.num}</div>
                    <div className="limit-card__title">{lim.title}</div>
                    <div className="limit-card__body">{lim.body}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          <section id="residual" className="meth-section">
            <Reveal className="meth-section__head" delay={40}>
              <span className="meth-section__index">
                07 · What the residual means
              </span>
              <h2 className="meth-section__title">
                The unexplained share <em>is</em> the finding.
              </h2>
            </Reveal>

            <ResidualReveal />
          </section>

          <section id="comparison" className="meth-section">
            <Suspense fallback={<ComparisonFallback />}>
              <MethodologyComparisonSection />
            </Suspense>
          </section>

          <section id="pooling" className="meth-section">
            <Suspense fallback={<PoolingFallback />}>
              <PooledExhibit />
            </Suspense>
          </section>
        </article>
      </div>
    </div>
  );
}

function ComparisonFallback() {
  return (
    <div>
      <div className="sec-eyebrow">
        <span className="num">08</span>
        <h2>Compare to an equal-weight donut</h2>
      </div>
      <p className="caption">Loading comparison…</p>
    </div>
  );
}

function PoolingFallback() {
  return (
    <div>
      <div className="sec-eyebrow">
        <span className="num">09</span>
        <h2>Why pooling misleads</h2>
      </div>
      <p className="caption">Loading both series…</p>
    </div>
  );
}
