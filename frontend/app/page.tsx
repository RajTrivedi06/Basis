import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/story/Reveal";
import { Tally } from "@/components/story/Tally";
import { getStoryData, shortDate, HERO_SKU } from "@/lib/story";

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

const usd = (n: number) => `$${n.toFixed(2)}`;

export default async function StoryPage() {
  const data = await getStoryData();
  const { bounds, activeProviders, totalOffers, skuCount, decomposition, artifact } =
    data;

  const providerCount = activeProviders.length > 0 ? activeProviders.length : null;
  const providerCountWord =
    providerCount === null
      ? "the"
      : ["zero", "one", "two", "three", "four", "five", "six", "seven"][
          providerCount
        ] ?? String(providerCount);

  const gapPp = artifact ? artifact.metrics.gap * 100 : null;
  const icc = artifact?.host_analysis.icc ?? null;
  const trainedDate = artifact ? shortDate(artifact.metadata.trained_at) : null;
  const anovaPct = artifact
    ? artifact.metrics.anova_explained_same_days * 100
    : null;
  const gbmPct = artifact ? artifact.metrics.holdout.r2_oos * 100 : null;

  return (
    <div className="story">
      {/* ————— Scene 1 · Hook (C1; bounds are p5/p95 per the robustness spec) */}
      <section className="story-scene story-scene--hook">
        <div className="story-frame">
          <div className="eyebrow" style={{ marginBottom: 28 }}>
            A public-data research study
          </div>
          {bounds ? (
            <h1 className="story-h1 serif">
              Right now, the exact same GPU rents for{" "}
              <span className="story-price">
                <Tally value={bounds.low} prefix="$" decimals={2} />
              </span>{" "}
              an hour on one cloud — and{" "}
              <span className="story-price">
                <Tally value={bounds.high} prefix="$" decimals={2} />
              </span>{" "}
              on another.
            </h1>
          ) : (
            <h1 className="story-h1 serif">
              The exact same GPU rents at prices several times apart —
              depending only on which cloud you ask.
            </h1>
          )}
          <p className="story-lede">
            Same chip. Same memory.{" "}
            {bounds ? (
              <span className="story-strong">
                A {bounds.multiple.toFixed(1)}× difference in price.
              </span>
            ) : (
              <span className="story-strong">A multiple, not a margin.</span>
            )}{" "}
            Basis is an attempt to answer one question:{" "}
            <em className="serif">why?</em>
          </p>
        </div>
      </section>

      {/* ————— Scene 2 · 01 The puzzle (C2, C3) */}
      <section className="story-scene story-scene--band">
        <div className="story-frame story-cols">
          <Reveal>
            <div className="eyebrow story-eyebrow">01 · The puzzle</div>
            <h2 className="story-h2 serif">A GPU-hour should be a commodity.</h2>
            <p className="story-body">
              A GPU-hour is one hour of computing time on a graphics card — the
              machines that train and run AI. Companies rent them by the hour,
              the way you&rsquo;d rent a car.
            </p>
            <p className="story-body">
              Wheat is wheat. Oil is oil. An H100 is an H100 — the silicon is
              identical.<sup className="story-fn"><a href="#sources">1</a></sup>{" "}
              So identical things should cost roughly the same.{" "}
              <span className="story-strong">
                They don&rsquo;t. Not even close.
              </span>
            </p>
          </Reveal>
          <Reveal delayMs={150}>
            {bounds ? (
              <div className="story-cards">
                <PriceCard
                  price={bounds.lowOffer.price}
                  provider={bounds.lowOffer.provider}
                  commitment={bounds.lowOffer.commitment}
                />
                <div className="story-cards__divider mono">
                  SAME HARDWARE · SAME DAY
                </div>
                <PriceCard
                  price={bounds.highOffer.price}
                  provider={bounds.highOffer.provider}
                  commitment={bounds.highOffer.commitment}
                  emphatic
                />
              </div>
            ) : (
              <p className="caption">
                Live quotes are momentarily unavailable — the dispersion page
                has the full picture.
              </p>
            )}
          </Reveal>
        </div>
      </section>

      {/* ————— Scene 3 · 02 Why "Basis" (C24 — A1 name scene).
          Diagram slot: the basis-bracket monogram lands here after the
          Director reviews the sketch (temp-doc/stage6-bracket-sketch.html). */}
      <section className="story-scene story-scene--band story-scene--white">
        <div className="story-frame" style={{ maxWidth: 720 }}>
          <Reveal>
            <div className="eyebrow story-eyebrow">02 · Why &ldquo;Basis&rdquo;</div>
            <h2 className="story-h2 serif">The gap has a name.</h2>
            <p className="story-body">
              When a trader hedges oil with a benchmark, the gap between the
              benchmark and the price they actually pay is called{" "}
              <em className="serif">basis</em>.<sup className="story-fn">
                <a href="#sources">2</a>
              </sup>{" "}
              It&rsquo;s the risk standardization can&rsquo;t remove. GPUs — the
              commodity compute is supposed to have become — carry that gap
              too. This project is named after it, and it measures it.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ————— Scene 4 · 03 The method (C4, C5; count structural) */}
      <section className="story-scene story-scene--band">
        <div className="story-frame">
          <Reveal>
            <div className="eyebrow story-eyebrow">03 · The method</div>
            <h2 className="story-h2 serif">
              Twice a day, we ask {providerCountWord} clouds the same question.
            </h2>
            <p className="story-body" style={{ maxWidth: 620 }}>
              &ldquo;What does an hour of GPU cost right now?&rdquo; Every
              answer — every publicly quoted price — is recorded exactly as
              received and kept forever. No private data, no paywalled feeds:
              only prices anyone could see.
            </p>
          </Reveal>
          <Reveal delayMs={200}>
            <div className="story-method">
              <div className="story-method__chips">
                {activeProviders.map((p) => (
                  <span key={p} className="story-chip mono">
                    {p}
                  </span>
                ))}
              </div>
              <div className="story-method__count">
                <div className="story-count serif">
                  {totalOffers !== null ? (
                    <Tally value={totalOffers} grouping />
                  ) : (
                    "—"
                  )}
                </div>
                <div className="caption">
                  price quotes recorded — and counting
                  {skuCount !== null ? ` · ${skuCount} canonical SKUs` : ""}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ————— Scene 5 · 04 Cleaning up (C6) */}
      <section className="story-scene story-scene--band story-scene--white">
        <div className="story-frame story-cols">
          <Reveal>
            <div className="eyebrow story-eyebrow">04 · Cleaning up</div>
            <h2 className="story-h2 serif">
              Every cloud describes the same chip differently.
            </h2>
            <p className="story-body">
              Before prices can be compared, the messy names have to be
              translated into one shared vocabulary. Basis does this with
              strict rules — and when a name doesn&rsquo;t match a rule,
              it&rsquo;s set aside, never guessed.
            </p>
            <p className="story-body">
              When information is missing, it&rsquo;s labeled{" "}
              <span className="mono story-unknown">UNKNOWN</span> and kept
              visible. Honesty about gaps is part of the method.
            </p>
          </Reveal>
          <Reveal delayMs={150}>
            <div className="story-stencil">
              {/* Real recorded raw names, verified against raw_observations
                  2026-08-03: vast reports "H100 SXM" (5,157 obs) and
                  tensordock "H100 SXM5 80GB"; both canonicalize to
                  h100_sxm_80gb in canonical_offers. Quarantine Rule: never
                  swap these for invented strings. */}
              <div className="story-stencil__raw mono">
                &quot;H100 SXM&quot;
              </div>
              <div className="story-stencil__raw mono">
                &quot;H100 SXM5 80GB&quot;
              </div>
              <div className="story-stencil__arrow">↓</div>
              <div className="story-stencil__canonical mono">
                {HERO_SKU}
                <span> one canonical name</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ————— Scene 6 · 05 The accounting (C7 — foundation renders the
          full-state ledger; the pinned scroll-scrub pass follows). */}
      <section className="story-scene story-scene--band">
        <div className="story-frame" style={{ maxWidth: 900 }}>
          <Reveal>
            <div className="eyebrow story-eyebrow">05 · The accounting</div>
            <h2 className="story-h2 serif">
              Take every price we can&rsquo;t explain — and subtract everything
              we can observe.
            </h2>
          </Reveal>
          {decomposition ? (
            <Reveal delayMs={150}>
              <LedgerBar d={decomposition} />
            </Reveal>
          ) : (
            <p className="caption">
              The live decomposition is momentarily unavailable — see the Basis
              page.
            </p>
          )}
        </div>
      </section>

      {/* ————— Scene 7 · 06 The finding (C8, C9, C10 — dates interpolate per A6) */}
      <section className="story-scene story-scene--band story-scene--white">
        <div className="story-frame" style={{ maxWidth: 820 }}>
          <Reveal>
            <div className="eyebrow story-eyebrow">06 · The finding</div>
            <h2 className="story-h2 serif">
              A bigger model doesn&rsquo;t explain it away.
            </h2>
            {gapPp !== null && icc !== null && trainedDate !== null ? (
              <p className="story-body">
                So we threw a 45-feature model at it. Out-of-sample, it still
                couldn&rsquo;t close the gap — it explains less than the four
                simple factors claimed in-sample ({gapPp.toFixed(1)}pp, as of{" "}
                {trainedDate}). And of what remains, over half tracks WHO the
                host is — identity, not specs (ICC {icc.toFixed(2)}).
              </p>
            ) : (
              <p className="story-body">
                So we threw a 45-feature model at it. Out-of-sample, it still
                couldn&rsquo;t close the gap — and of what remains, over half
                tracks WHO the host is. The explainability page carries the
                current bound.
              </p>
            )}
            {anovaPct !== null && gbmPct !== null && gapPp !== null && (
              <BoundCompare
                anovaPct={anovaPct}
                gbmPct={gbmPct}
                gapPp={gapPp}
              />
            )}
            <p className="story-body" style={{ marginTop: 20 }}>
              Unexplained share in market-priced segments has ranged ~20–61%
              across recent weeks — basis risk is segment- and
              time-conditional.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ————— Scene 8 · 07 Why it matters + CTA (C11–C14) */}
      <section className="story-scene story-scene--band">
        <div className="story-frame story-cols">
          <Reveal>
            <div className="eyebrow story-eyebrow">07 · Why it matters</div>
            <h2 className="story-h2 serif">
              You can&rsquo;t build financial plumbing on a price you
              can&rsquo;t explain.
            </h2>
            <p className="story-body">
              There&rsquo;s growing interest in treating AI compute like a
              commodity — with price indexes, futures, and contracts built on
              top of it.<sup className="story-fn"><a href="#sources">3</a></sup>{" "}
              All of that assumes a GPU-hour has a knowable market price.
            </p>
            <p className="story-body">
              Basis suggests that assumption deserves scrutiny: a large share
              of the price of a GPU-hour is not accounted for by where it is,
              how it&rsquo;s rented, who sells it, or what comes with it. That
              unexplained remainder is the risk any benchmark would silently
              absorb.
            </p>
          </Reveal>
          <Reveal delayMs={150}>
            <div className="story-honesty">
              <HonestyCard
                title="It's a study, not a product"
                body="No accounts, no sign-up, nothing for sale. Just public data and a transparent method."
              />
              <HonestyCard
                title="Every number has a receipt"
                body="From the headline percentage down to the raw response a cloud sent us — every step is inspectable."
              />
              <HonestyCard
                title="Honest about limits"
                body="Quoted prices, not transactions. A months-long window, not years. The caveats are on every page."
              />
            </div>
          </Reveal>
        </div>
        <Reveal delayMs={250}>
          <div className="story-cta">
            <div className="serif story-cta__line">
              Now explore the data yourself.
            </div>
            <div className="story-cta__buttons">
              <Link className="btn" href="/findings">
                Open the dashboard
              </Link>
              <Link className="btn ghost" href="/methodology">
                Read the methodology →
              </Link>
            </div>
          </div>
        </Reveal>

        {/* C23 — FINAL, verbatim (Raj, 2026-08-03). Do not edit this copy. */}
        <div className="story-frame">
          <div className="story-attrib">
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
            <p className="serif story-attrib__sig">— Raj</p>
          </div>
        </div>

        <div className="story-frame">
          <div id="sources" className="story-sources">
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              Sources
            </div>
            {/* Hrefs resolve at the citations pass before this branch merges
                (claims-audit gate, design doc §5.1) — text-only until each
                link is verified real. */}
            <ol className="story-sources__list">
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
            <p className="caption" style={{ marginTop: 8 }}>
              The GPU spread itself is our own live data —{" "}
              <Link href="/dispersion">see the dispersion page</Link>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function PriceCard({
  price,
  provider,
  commitment,
  emphatic = false,
}: {
  price: number;
  provider: string;
  commitment: string;
  emphatic?: boolean;
}) {
  return (
    <div className={`story-tag panel${emphatic ? " story-tag--high" : ""}`}>
      <div>
        <div className="mono story-tag__sku">NVIDIA H100 SXM · 80 GB</div>
        <div className="caption">
          quoted on {provider} · {commitment.replace(/_/g, " ")}
        </div>
      </div>
      <div className="serif story-tag__price">
        {usd(price)}
        <span>/hr</span>
      </div>
    </div>
  );
}

function LedgerBar({ d }: { d: import("@/lib/types").BasisDecompositionResponse }) {
  const total = d.total_variance;
  const segs = [
    { name: "Region", v: d.variance_from_region },
    { name: "Commitment", v: d.variance_from_commitment },
    { name: "Provider", v: d.variance_from_provider },
    { name: "Bundle", v: d.variance_from_bundle },
  ].map((s) => ({ ...s, pct: total > 0 ? (s.v / total) * 100 : 0 }));

  return (
    <div>
      <div className="story-ledger">
        {segs.map((s) => (
          <div
            key={s.name}
            className="story-ledger__seg"
            style={{
              width: `${s.pct}%`,
              background: `var(--factor-${s.name.toLowerCase()})`,
            }}
            title={`${s.name} ${s.pct.toFixed(1)}%`}
          />
        ))}
        <div
          className="story-ledger__seg story-ledger__seg--residual"
          style={{ width: `${d.pct_residual}%` }}
        >
          <span className="mono">UNEXPLAINED</span>
          <span className="serif story-ledger__big">
            {d.pct_residual.toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="story-ledger__legend mono">
        <span>
          share of price variation · {d.gpu_sku} · {d.date} (UTC)
        </span>
        <span>
          explained by four factors:{" "}
          <strong>{d.pct_explained.toFixed(1)}%</strong>
        </span>
      </div>
      <p className="story-body" style={{ marginTop: 18, maxWidth: 640 }}>
        Where the machine is. How it&rsquo;s rented. Who sells it. What comes
        bundled with it. Everything observable, accounted for — and still, a
        large share of the price has no explanation.
      </p>
    </div>
  );
}

/**
 * Candidate A (design doc §6): two compared bars on one axis, the
 * out-of-sample bound falling SHORT of the in-sample line. In-sample /
 * out-of-sample labels are REQUIRED (Director ruling). The basis-bracket
 * shortfall annotation is added once the Director approves the motif
 * sketch (A4).
 */
function BoundCompare({
  anovaPct,
  gbmPct,
  gapPp,
}: {
  anovaPct: number;
  gbmPct: number;
  gapPp: number;
}) {
  return (
    <div className="story-bound" role="img" aria-label={`Four factors in-sample explain ${anovaPct.toFixed(1)} percent; the 45-feature model out-of-sample explains ${gbmPct.toFixed(1)} percent — ${gapPp.toFixed(1)} percentage points less.`}>
      <div className="story-bound__row">
        <div className="mono story-bound__label">
          4 factors · <strong>in-sample</strong> (ANOVA)
        </div>
        <div className="story-bound__track">
          <div
            className="story-bound__bar"
            style={{ width: `${anovaPct}%` }}
          />
          <div
            className="story-bound__rule"
            style={{ left: `${anovaPct}%` }}
            aria-hidden
          />
        </div>
        <div className="mono story-bound__val">{anovaPct.toFixed(1)}%</div>
      </div>
      <div className="story-bound__row">
        <div className="mono story-bound__label">
          45 features · <strong>out-of-sample</strong> (GBM bound)
        </div>
        <div className="story-bound__track">
          <div
            className="story-bound__bar story-bound__bar--oos"
            style={{ width: `${gbmPct}%` }}
          />
          <div
            className="story-bound__rule"
            style={{ left: `${anovaPct}%` }}
            aria-hidden
          />
        </div>
        <div className="mono story-bound__val">{gbmPct.toFixed(1)}%</div>
      </div>
      <div className="caption" style={{ marginTop: 8 }}>
        The richer model, honestly tested, explains {gapPp.toFixed(1)}pp{" "}
        <em>less</em> — the shortfall is the finding.
      </div>
    </div>
  );
}

function HonestyCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="panel story-honesty__card">
      <div className="story-honesty__title">{title}</div>
      <div className="story-honesty__body">{body}</div>
    </div>
  );
}
