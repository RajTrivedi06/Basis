# Stage 6 Design Doc — The Story Layer

**Status: SIGNED (Director, 2026-08-02) — sign-off granted effective upon
amendments A1–A7 being committed (this commit). The gate for 6.2+ is OPEN.
Outstanding artifact: the bracket-diagram sketch goes to the Director for one
look before the motif spreads (A1/A4). C23 CLOSED 2026-08-03 — Raj's own words
on record in §10.**
Author: Manager · 2026-08-02 · References: `design/stage6-references/` (PR #54)

---

## 1. Frozen direction summary

Cream editorial (`#FAF9F5` ground, `#FFFFFF` surfaces, `#E8E4DB` hairlines), serif
statements, mono data labels (uppercase, letter-spaced eyebrows), numbered nav 01–06
as pills with a PUBLIC DATA chip, terracotta `#C15F3C` as accent. Footer carries
"Not a price aggregator · Not a derivatives engine". **No further exploration** — the
only open aesthetic questions are the three Raj decisions below.

The current dark theme (amber residual, Fraunces/Inter/JetBrains) is fully retired at
6.1. Nothing in Stage 6 hardcodes a finding: every number binds to the live API or to
truth-patch copy, so the 5.7 retrain's new artifact values flow into all pages
automatically.

**THE QUARANTINE RULE (verbatim in every dev prompt):** The reference designs in
`design/stage6-references/` are the spec for layout, motion, and tone ONLY. Every
number, provider list, chart shape, and finding comes from the live API or
truth-patch copy. Any reference component that cannot render the TRUE result
(negative gap, live ranges, 5 providers, retired TensorDock) gets redesigned — never
the reverse. Charts render real data's real shape: no idealized curves.

## 2. RAJ DECISION #1 — the serif (one family, site-wide)

Two candidates; specimen sheet rendered from real headline copy at
`temp-doc/stage6-serif-specimen.html` (open in a browser; both load from Google
Fonts).

| | **Newsreader** (DC files) | **Playfair Display** (screenshot-set didone) |
|---|---|---|
| Character | Editorial text serif, optical-size axis 6–72, true italics | High-contrast didone; hero numerals with real presence |
| Hero numerals (−10.9pp / 0.55) | Confident, slightly bookish | Heavier, more "magazine cover" (the 60%/82% look in `findings-hero.png`) |
| Body/pull-quote sizes | Excellent — opsz axis keeps small sizes readable | Weak below ~24px; hairlines break up on low-DPI |
| Single-family discipline | Holds everywhere | Would pressure us into a second serif for running text |

**Recommendation: Newsreader.** The site's serif does triple duty (hero numerals,
scene statements, italic pull-quotes down to 16px); Newsreader's optical sizing
handles all three, and the DC references — our motion/layout spec — are already set
in it, so what Raj approved visually is what ships. Playfair wins only the single
frame where a numeral is 110px tall, and choosing it means either living with weak
text-size serifs or breaking the one-family rule.
Load via `next/font` with `display: swap`, weights 400–600 + italic, opsz auto.

> **DECISION #1 (Raj): Newsreader — site-wide, one family, per the specimen
> evidence.** Ruled 2026-08-02, relayed by Raj; recorded by Manager.

## 3. RAJ DECISION #2 — the residual's exclusive color (ADR-0005 addendum)

The residual is the finding; it gets ONE color, owned outright, evicted from all
decorative use. Candidates:

- **Void (near-black), Director lean.** A dedicated near-void — proposed
  `--residual: #171512` (one step deeper than ink `#1F1D1A`) — for every data-graphic
  encoding of the unexplained: chart segments, hero numerals, stat values, the
  residual bar terminus. Reads as "the part with no light in it," which IS the
  thesis; the reference screenshots already render the residual segment as a black
  block (`explainability.png`, `thumb-basis-and-methodology.png`). Terracotta is then
  demoted to purely editorial accent — eyebrows, links, annotations, active nav —
  and **never encodes data**.
- **Terracotta.** The residual keeps `#C15F3C` (as in `basis-decomposition.png`),
  and terracotta is evicted from ALL editorial use — no orange eyebrows, links, or
  hovers anywhere. Louder residual, but a much more monochrome site chrome, and the
  DC references' editorial tone (terracotta eyebrows/links throughout) would need
  reworking — against the spirit of the freeze.

**Recommendation: void.** Written as ADR-0005 addendum at sign-off; commit
message references this section.

Addendum text (committed to `docs/01-architecture/adr/0005-residual-first-ui.md`):
*"2026-08-02 (Stage 6): the residual's exclusive color is void near-black
`#171512`. It appears wherever the unexplained share is encoded — chart segments,
hero numerals, stat values — and nowhere else. Terracotta `#C15F3C` carries no data
meaning anywhere on the site. The amber residual of the dark theme is retired."*

> **DECISION #2 (Raj): void near-black `#171512`, exclusively owned by the
> residual; terracotta demoted to purely editorial accent.** ADR-0005 addendum
> committed as pre-written (see `docs/01-architecture/adr/0005-residual-first-ui.md`).
> Ruled 2026-08-02, relayed by Raj; recorded by Manager.
>
> **Amended 2026-08-03 (Raj):** the DC reference's own chart grammar governs —
> terracotta is the chart-mark accent for single-series line/dot marks; void
> keeps exclusive ownership of residual-share encodings (segments, numerals,
> stat values, bound bars). Terracotta never represents the residual share
> itself. ADR-0005 addendum amended to match.

## 4. RAJ DECISION #3 — pooled-series visibility (Stage 5 blocker #3)

The truth patch removed the last pooled-chart consumer. Question: does a pooled view
exist anywhere?

**Director recommendation (endorsed): YES, as a teaching exhibit** in the
Basis/methodology area — pooled vs market-priced series side by side, with the
Jul-28 catalog annotation and era-D marker, framed as **"why pooling misleads"**:
adding Azure/GCP's fixed list catalogs mechanically collapses the pooled residual
while the market-priced series keeps moving on its own dynamics. Companion to the
donut-vs-bar exhibit (two framings of the same data). **Not on the landing.** Both
series come from `getBasisTimeseries` (with/without the catalog exclusion) — no new
analysis, no new endpoint.

> **DECISION #3 (Raj): YES — "why pooling misleads" teaching exhibit in the
> methodology/Basis area with the Jul-28 catalog and era-D annotations; never on
> the landing.** Ruled 2026-08-02, relayed by Raj; recorded by Manager.

## 5. Scene map — the SSR scrollytelling landing (Task 6.2)

Eight scenes: the 7-scene structure of `dc/Basis Story.dc.html` plus the name scene
(A1) between the puzzle and the method. Scene skeletons, reveal motion, sticky
mechanics, and count-up easing carry over from the DC reference; eyebrow numbers run
01–07. **All data live-binds**;
the DC files' numbers (4 providers, "four clouds", 60.3%, ~60/~82, $0.45/$6.88,
315,204 offers, fabricated factor shares) are quarantined.

| # | Scene (eyebrow) | Content + data binding |
|---|---|---|
| 1 | **Hook** | "Right now, the exact same GPU rents for $LOW an hour on one cloud — and $HIGH on another." LOW/HIGH/multiple = live same-day **robust bounds** for the canonical hero SKU — p5/p95 of the day's quotes (or junk-filtered min/max), never raw min/max (C1 robustness spec, binding), server-fetched via `getDispersion` / `getOffers`. Renders the real ratio, whatever it is that day. |
| 2 | **01 · The puzzle** | "A GPU-hour should be a commodity." Two price cards = the same two live offers from Scene 1, with real provider labels ("rented on a marketplace" / "rented on a hyperscaler" only if factually the segments those offers are in). |
| 3 | **02 · Why "Basis"** (NEW — A1, the name scene) | Interstitial explaining the name via the site's one bespoke diagram: two plain price lines (benchmark, price-actually-paid) with a dimension bracket measuring the gap, labeled *basis*; the same bracket then rhymes onto two GPU price tags. Copy = C24. Fully static/SSR (no data binding; the two GPU tags may echo Scene 1's live robust bounds). The bracket is the site's monogram and recurring motif (§13) — **Director reviews the sketch before it propagates.** Carries a footnote marker to the Sources block (commodity-basis definition). |
| 4 | **03 · The method** | "Twice a day, we ask N clouds the same question." N and the provider chip list derived structurally from `getProviders` (active = 5 today; retired TensorDock does not appear here). Offer counter = live total offers, count-up. |
| 5 | **04 · Cleaning up** | Normalization scene as-is (raw name rows → one canonical name). Raw-name examples must be real strings from real payloads (pull from `getRawObservationExplain` samples at build/authoring time, cited in code comment). UNKNOWN-honesty line stays. |
| 6 | **05 · The accounting** (sticky, ~520vh) | Sticky decomposition performance: segments grow as captions advance. Factor shares = live from `getBasisDecomposition` for the hero SKU (market-priced framing consistent with the hero series). Captions name Region → Commitment → Provider → Bundle in the sequential-ANOVA order the API returns; the "all four together: X%" caption interpolates the live tally — no promised "about 40%". Residual reveal = live residual share, in the residual color. |
| 7 | **06 · The finding — REBUILT (the missing act)** | The two-anchor + live-range finding, replacing the old ~60/~82 split. Narrative beat: *"So we threw a 45-feature model at it. Out-of-sample, it still couldn't close the gap — it explains less than the four simple factors claimed in-sample (−{gap}pp, as of {trained_date}). And of what remains, over half tracks WHO the host is (ICC {icc}) — identity, not specs."* **All three values AND the date interpolate from `/api/ml/explainability` (`trained_at`) — no hardcoded dates (A6); the 5.7 retrain must flow through with zero copy edits.** Third element in range language: *"The unexplained share in market-priced segments has ranged ~20–61% in recent weeks — segment- and week-conditional."* Range language sourced from truth-patch copy. Visual = the negative-gap bound component (§6). |
| 8 | **07 · Why it matters + CTA** | "You can't build financial plumbing on a price you can't explain." Three honesty cards (study-not-product / every-number-has-a-receipt / honest-about-limits) carry over. C12 carries a footnote marker to the Sources block (compute-as-commodity framing). CTA: "Open the dashboard" → `/` dashboard area (Findings), "Read the methodology →". Attribution block C23 (A3) sits at story's end near the footer (or a compact /about — Manager's call at build), followed by the Sources block (§5.1). |

**Standing narrative ruling (Director, 2026-08-01, binds all Scene 6 + interior
copy):** the negative gap and the host ICC are ONE picture, not two independent
confirmations — the GBM's holdout R² comes substantially from re-identifying hosts
via hardware-fingerprint proxies. Copy must narrate them as a single sequence
("couldn't close the gap → and what remains tracks host identity"), never as
"two separate lines of evidence." C9 below is written to this rule; the voice pass
must not reintroduce independence framing.

Motion inventory (all from the DC reference, all behind `prefers-reduced-motion`
which the reference already handles — keep it): IO reveals at 0.25 threshold,
translateY(28px) → 0 at 0.8s ease; sticky scroll-progress → segment widths with
per-segment [start, end] windows; caption crossfade 0.45s; count-up cubic ease-out.
Reduced motion = everything rendered at final state, scroll-snap off.

### 5.1 Citations layer + claims audit (A5 — 6.2 acceptance criterion)

Footnote markers on world-claims — C3's commodity framing, C12's
compute-as-commodity paragraph, and the C24 name scene — resolve to a quiet
**Sources block** at story's end (after C23): the commodity-basis definition (CME
glossary or any standard text), the compute-as-commodity framing (Ornn's public
materials; the Friedman essays from the original proposal), and the GPU spread
(our own live data, linked to the dashboard). House restraint: small type, no
decoration.

**Ruled acceptance criterion for 6.2:** a **claims-audit table** classifying every
declarative sentence on the landing as one of `live-bound` / `our-finding-dated` /
`world-claim-cited` / `definitional` — zero unclassified rows. The table ships in
the 6.2 PR (temp-doc), and the review prompt requires checking it against the
rendered page.

## 6. Component brief — the negative-gap bound visual (Director picks at sign-off)

The reference three-segment bar (`explainability.png`: ANOVA + richer-features +
still-unexplained summing to 100%) **assumes the ML model explains MORE than ANOVA
(gap ≥ 0) and cannot render the truth**: out-of-sample the 45-feature GBM explains
*less* (R² 0.454 vs in-sample ANOVA 0.563, gap −10.9pp). Two candidates:

- **Candidate A — two compared bars, bound drawn BELOW the ANOVA line.** Two
  horizontal bars on one 0–100% axis: top = "4 factors, in-sample (ANOVA)" ending at
  its live share with a dashed vertical rule dropped through both rows; bottom =
  "45 features, out-of-sample (GBM bound)" ending SHORT of the rule. The shortfall
  between bar-end and rule is bracketed and labeled with the live gap ("−10.9pp —
  the richer model, honestly tested, explains less"). Right of the rule shades in
  the residual color to 100%. Strength: the falling-short is impossible to misread.
- **Candidate B — one-axis bracket (dumbbell).** Single 0–100% axis with two markers
  — ANOVA in-sample and GBM out-of-sample — joined by a bracket labeled with the
  gap, and a two-line asymmetry caption ("in-sample flatters; out-of-sample is the
  honest test — the bound moved DOWN"). Residual region shaded beyond the higher
  marker. Strength: quieter, reads as measurement rather than contest; weaker at
  a glance for lay readers.

Both live-bind gap/R²/date from `/api/ml/explainability` and render correctly for
either gap sign (if a future retrain flips it positive, the same geometry shows the
bound above the line). **Manager recommendation: A** — the landing needs the
unmissable version; B can serve the explainability interior if Director wants both.

> **Director pick: Candidate A (two compared bars), with the in-sample /
> out-of-sample labels REQUIRED on the two bars.** Ruled 2026-08-02.
> A4 addendum: the shortfall annotation renders as the **basis bracket** — the
> §13 dimension-bracket motif introduced by the name scene — so the site's one
> diagram grammar measures this gap too.

## 7. Week-motion presentation (blocker #6)

How the landing/basis pages speak about the live series' movement:

- **Range language everywhere a live share is narrated:** "has ranged ~20–61% in
  recent weeks — segment- and week-conditional." Never a bare point value in
  narrative copy; point values appear only in charts/stat strips with a date or
  window label attached.
- **Era annotations on every residual time series:** Jul 26 — era D (Vast spot
  becomes visible) · Jul 28 — Azure/GCP list catalogs join (excluded from
  market-priced series). Same annotation component reused; copy from truth patch.
- **The two anchors are the stable spine:** frozen, dated structural claims
  (gap, ICC) carry the story; the live series is allowed to move under them.
- **Absolute-variance companion series stays parked (v4).** No new analysis.

## 8. SSR requirement (blocker #2)

**The STORY must exist in initial HTML; only the THEATER hydrates.**

- The landing route is a **server component**. All narrative copy — every scene
  headline, caption text, and the Scene 6 finding — is server-rendered. Data for
  server-rendered numbers (anchors, provider count, offer totals) is fetched
  server-side from the API with `revalidate: 900` (15 min, matching the ML
  endpoint's cache), with a graceful degraded state (range language + "—") if the
  API is unreachable at render time.
- **Client islands, thin:** an IO-reveal wrapper (adds a class; CSS does the
  motion), the sticky-scene scroll-progress driver, and count-up number spans that
  render the FINAL value as server HTML and only animate after hydration. Charts
  remain client components as today.
- Sticky captions are all present in the server HTML (stacked, opacity-toggled) —
  crossfade is presentation, not content.
- **Proof (carried into 6.2's task proof):** `curl`/view-source shows all scene
  copy + both anchors; rendered-DOM assertions post-hydration; reduced-motion pass.
- This also retires blocker #2's FindingsHero problem on the landing path; the
  Findings interior gets the same treatment in 6.3 where practical.

## 9. Canonical form (blocker #7)

**www everywhere** (Vercel already 308s apex → www). In scope for 6.2/6.5:
`metadataBase = https://www.gpu-basis.xyz`, per-route `alternates.canonical`,
OpenGraph/Twitter metadata on all six routes + landing, sitemap + robots emitting
www URLs only, and a sweep of docs/copy for bare-apex references. Verification at
6.5: `curl -sI` apex → 308 → www; every rendered page's canonical tag is www.

## 10. Copy inventory — awaiting Raj's VOICE PASS

Every headline/scene/caption below ships only after Raj marks what doesn't sound
like him; **his edits are final copy.** Sources: `dc/Basis Story.dc.html` (scene §),
screenshot set, truth-patch copy (verbatim, already voice-approved), or NEW.

| # | Where | Proposed copy | Source |
|---|---|---|---|
| C1 | Scene 1 hook | "Right now, the exact same GPU rents for $LOW an hour on one cloud — and $HIGH on another." + "Same chip. Same memory. A N× difference in price. Basis is an attempt to answer one question: *why?*" **Robustness spec (Director, binding on 6.2):** LOW/HIGH/N× bind to robust bounds — p5/p95 of the day's quotes for the hero SKU (or junk-filtered min/max), never raw min/max, so a $0.12 garbage listing can never put a 200× spread in the site's first sentence. Scene 2's two price cards draw from the same robust selection (real offers at/near those bounds). 6.2 proof asserts the bound source. | Story §1 · approved w/ spec |
| C2 | Scene 2 head | "A GPU-hour should be a commodity." | Story §2 |
| C3 | Scene 2 body | "Wheat is wheat. Oil is oil. An H100 is an H100 — the silicon is identical. So identical things should cost roughly the same. They don't. Not even close." | Story §2 · Director edit adopted |
| C4 | Scene 3 head | "Twice a day, we ask five clouds the same question." (count structural) | Story §3, count fixed |
| C5 | Scene 3 body | "'What does an hour of GPU cost right now?' Every answer — every publicly quoted price — is recorded exactly as received and kept forever. No private data, no paywalled feeds: only prices anyone could see." (The reference's "no accounts, no scraping tricks" is factually false post-auth-fixes: collection uses a Vast API key, AWS IAM, and a GCP key.) | Story §3 · Director edit adopted |
| C6 | Scene 4 head/body | "Every cloud describes the same chip differently." + strict-rules / never-guessed / UNKNOWN-kept-visible lines | Story §4 |
| C7 | Scene 5 captions (6) | Accounting captions, Region → Commitment → Provider → Bundle, with live-tally interpolation; final: "Everything observable, accounted for. And still — a large share of the price has no explanation." | Story §5, tally + hedge fixed |
| C8 | Scene 6 head | "A bigger model doesn't explain it away." | Director edit adopted |
| C9 | Finding-scene body | "So we threw a 45-feature model at it. Out-of-sample, it still couldn't close the gap — it explains less than the four simple factors claimed in-sample (−{gap}pp, as of {trained_date}). And of what remains, over half tracks WHO the host is — identity, not specs (ICC {icc})." **Gap, ICC, and date interpolate from the artifact's `trained_at` (A6) — never hardcoded; current values −10.9pp / 0.554 / Jul 31 are examples only and refresh with the 5.7 retrain.** | NEW, anchored to truth-patch hero · A6 |
| C10 | Scene 6 range line | "Unexplained share in market-priced segments has ranged ~20–61% across recent weeks — basis risk is segment- and time-conditional." | truth patch, verbatim |
| C11 | Scene 7 head | "You can't build financial plumbing on a price you can't explain." | Story §7 |
| C12 | Scene 7 body | interest-in-compute-as-commodity ¶ + "that unexplained remainder is the risk any benchmark would silently absorb." | Story §7 |
| C13 | Scene 7 cards | "It's a study, not a product" / "Every number has a receipt" / "Honest about limits" (3 cards) | Story §7 |
| C14 | CTA | "Now explore the data yourself." · "Open the dashboard" · "Read the methodology →" | Story §7 |
| C15 | Methodology hero | "Measuring what the market cannot explain." + stat strip (providers · 2× daily · Sequential ANOVA · residual range) | `methodology-hero.png` |
| C16 | Methodology pull-quote | "If a benchmark designer can't tell you which adjustments produced the headline number, the headline number is doing the wrong job." | `methodology-hero.png` |
| C17 | Methodology sections | Five truth-patch insertions carried over **verbatim** — not subject to voice pass (already approved) | truth patch |
| C18 | Providers head | "Five providers, five postures." (count structural; falls back gracefully as count changes) | `providers.png`, count fixed |
| C19 | Pooled exhibit (per Decision #3) | "Why pooling misleads: add two fixed price catalogs and the pooled residual collapses — while the market keeps moving." | NEW |
| C20 | Footer | "Basis — research artifact · public data · 2026" · "Not a price aggregator · Not a derivatives engine" | Story footer |
| C21 | Glossary (tap-to-explain) | **Residual** — the share of price differences left over after accounting for everything sellers publicly disclose. · **Spot** — discounted capacity the provider can take back at any time. · **Decomposition** — splitting total price variation into named causes, one factor at a time. · **ICC** — how much of the leftover variation sticks to the same specific machines day after day. | Director seeds adopted |
| C22 | Header tagline + meta/OG description (A2, rides §9 metadata scope) | "Basis — measuring what the GPU market cannot explain." | Director A2 |
| C23 | Attribution block — end-of-story, signature-line treatment | **FINAL, verbatim (Raj, 2026-08-03):** "I was just bored and curious. So here it is: [GitHub link]" signed "— Raj". Link target: the public repo `github.com/RajTrivedi06/Basis`. **Director rider:** full name "Raj Trivedi" goes in author meta + OG metadata under C22 scope — **page copy stays exactly as written.** | A3 · CLOSED (Raj's own words; Director rider recorded) |
| C24 | Name scene (A1, between puzzle and method) | "When a trader hedges oil with a benchmark, the gap between the benchmark and the price they actually pay is called basis. It's the risk standardization can't remove. GPUs — the commodity compute is supposed to have become — carry that gap too. This project is named after it, and it measures it." + footnote marker → Sources | Director A1 draft, voice-passed in principle |
| C25 | Sources block (A5, story's end after C23) | Commodity-basis definition (CME glossary or standard text) · compute-as-commodity framing (Ornn public materials; Friedman essays from the original proposal) · the GPU spread (our own live data → dashboard link) | Director A5 |

> **VOICE PASS: COMPLETE 2026-08-02.** Director's edits to C3, C5, C8, and the C21
> seeds adopted; C1 approved with the binding robustness spec; all other rows
> approved as written. The table above IS final copy.
> **A7 note (Director):** accepted as recorded; copy edits remain cheap until the
> 6.5 freeze. C23 (per A3) is the outstanding voice item.

## 11. Out of scope (restated)

Gamification mechanics · replay→true streaming for Ask (v4) · absolute-variance
companion series (v4) · any new analysis. Also unchanged: no user accounts, no
ML-based normalization, raw observations immutable.

## 12. Animation tooling — the GSAP whitelist (Director-approved, pre-6.2)

GSAP is admitted for the scrollytelling landing under a hard whitelist:

- **Allowed: `gsap` core, `ScrollTrigger`, `@gsap/react` (useGSAP). Landing page
  only.** Interior pages (6.3) stay CSS/IO — no GSAP imports outside the landing
  route's components.
- No other plugins without a design-doc amendment (no ScrollSmoother, SplitText,
  Flip, Draggable, etc.).
- The official GSAP AI skills are installed for the agents (`.agents/skills/`,
  gitignored tooling): **skills teach how, the whitelist decides what.**
- **`ScrollTrigger.refresh()` after live-data hydration** — API-bound text can
  change layout, so trigger positions are recomputed once data lands.
- §8's SSR contract is unchanged: GSAP animates presentation only; every word and
  number exists in server HTML before any tween runs.
- Reduced motion via `gsap.matchMedia('(prefers-reduced-motion: reduce)')` —
  final-state rendering, no tweens, consistent with §5.

## 13. Art-direction grammar (A4 — Director-ruled; future sessions cite THIS when cutting decoration)

**Governing metaphor: a ledger for a commodity that refuses to balance.** The void
ink (`#171512`) is the entry that can't be filed — which is why it is the
residual's color and nothing else's (§3, ADR-0005 addendum).

**The five component-object pairs** (every bespoke component maps to a ledger
object; anything that maps to none is decoration and gets cut):

| Ledger object | Component |
|---|---|
| **Price tag + bracket** | Scene 1/2 price cards (tags) and the dimension bracket that measures the gap between them — the *basis* bracket, the site's monogram (born in the name scene, reused on Candidate A's shortfall) |
| **Receipt drawer** | The contributing-observations / provenance drawers — every number has a receipt |
| **Stencil** | Normalization: messy vendor strings stenciled into one canonical name |
| **Tally-stamp** | Count-up stat numerals — values get stamped into the ledger as they arrive |
| **Recurring machines** | The provider chips / twice-daily collection rhythm — the same machines, asked again and again |

**The three motion laws** (§5's motion inventory implements these; the laws
outrank the inventory):

1. **Animation only performs acts of accounting** — revealing an entry, drawing a
   bracket, stamping a tally, filing a receipt. Motion that performs nothing is cut.
2. **Scroll drives; nothing autoplays.** All motion is scroll-entered or
   scroll-scrubbed; no loops, no idle animation.
3. **Count-ups only for API-served values.** A number that tweens is a number the
   API just delivered; static claims never animate.

**The lexicon.** Allowed verbs/nouns: *quoted, recorded, filed, tallied, stamped,
receipt, gap*. Banned anywhere on the site: *insights, powerful, platform,
leverage, unlock*. (Adds to, does not replace, the truth-patch language rules.)

## 14. Approved chart redesign briefs (Director ruling, 2026-08-03)

All three approved; sequence: 6.3b recolor (chart-mark grammar, PR #58) →
design-tool variants (Raj runs
`temp-doc/stage6-prompts/design-tool-chart-redesign-prompt.md`) → Director/Raj
pick → **6.3c implements**.

1. **Ledger waterfall** replaces the decomposition bar as the numbers-carrying
   view ("the best component idea of the stage" — Director). Small factors get
   full-width rows so a 4.8% reads like a 60%; subtraction performed line by
   line per the §13 metaphor; the unfileable remainder in void, measured by the
   bracket; mobile-free by construction. The one-line stacked bar survives as a
   glance-glyph above it.
2. **Dispersion band**: contrast fixes (terracotta median per the amended
   grammar, visible p25/p75 edges, stronger band), larger plot area, and a
   tap/hover **crosshair** with a mono readout — ruled §13-legal ("it reads a
   ledger entry").
3. **Price-by-factor**: mobile rotation to horizontal beeswarm rows +
   **receipt-card taps** wiring into the existing provenance drawer.

**Accent colors beyond this grammar: PARKED post-Stage-6** (Director + Manager
concurring). Guardrails for when it reopens: (a) it's a cheap token swap by
design — 6.1 tokenized everything for exactly this; (b) the swap governs the
accent ONLY — the void residual is ADR-law, and the cream/ink/serif identity is
frozen. Changing terracotta is redecorating; touching the residual's color is
reopening a ruling.

## 15. Mobile amendments to Task 6.4 (Director ruling, 2026-08-03)

1. **The DC mobile files are 6.4's primary layout reference**
   (`design/stage6-references/dc/Basis Story Mobile.dc.html`,
   `…/Basis Dashboard Mobile.dc.html`): fix pages **toward the DC mobile
   layouts**, not toward "current desktop, squeezed."
2. **Fluid type scale via `clamp()`** — every size defined min / preferred-vw /
   max — plus `overflow-wrap` on long mono strings (`h100_sxm_80gb` is the
   usual cream-page culprit). Named requirement: **no global font shrinking;
   390px must be readable, not miniature.**

---

## Decisions record

| Decision | Choice | Date | Recorded by |
|---|---|---|---|
| #1 Serif | **Newsreader**, site-wide, one family | 2026-08-02 | Manager (Raj relay) |
| #2 Residual color (ADR-0005 addendum) | **Void near-black `#171512`**; terracotta purely editorial | 2026-08-02 | Manager (Raj relay) |
| #3 Pooled-series visibility | **YES** — teaching exhibit, methodology/Basis area, never landing | 2026-08-02 | Manager (Raj relay) |
| §6 bound-visual candidate | **A** (two bars) w/ in-sample/out-of-sample labels required | 2026-08-02 | Manager (Director ruling) |
| Voice pass | **COMPLETE** — Director edits C3/C5/C8/C21 adopted, C1 robustness spec binding, rest approved as written; A7: C23 is the one outstanding voice item (Raj's own words) | 2026-08-02 | Manager (Raj relay) |
| Amendments A1–A7 | **FOLDED** — name scene C24 (§5 row 3) · C22 tagline/OG · C23 attribution (pending Raj text) · §13 art-direction grammar · §5.1 citations layer + claims-audit criterion · A6 date interpolation (C9, finding scene) · A7 note | 2026-08-02 | Manager |
| **Director sign-off** | **GRANTED — effective upon the A1–A7 commit (this commit). Follow-up artifacts: bracket-diagram sketch to Director before the motif propagates; Raj's C23 text.** | 2026-08-02 | Manager (Raj relay) |

**Process rule (Director, standing, 2026-08-02):** any Director ruling that touches
the design doc is relayed as a **quoted block, verbatim** — never a summary. (A1/A2/
A4's first passes were lost to paraphrase.)
