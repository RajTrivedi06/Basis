# Stage 6 Design Doc — The Story Layer

**Status: DRAFT — awaiting Raj decisions #1–#3 + voice pass, then Director sign-off.
This doc is the GATE for Tasks 6.2+.**
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

Port of the 7-scene structure in `dc/Basis Story.dc.html`; scene skeletons, reveal
motion, sticky mechanics, and count-up easing carry over. **All data live-binds**;
the DC files' numbers (4 providers, "four clouds", 60.3%, ~60/~82, $0.45/$6.88,
315,204 offers, fabricated factor shares) are quarantined.

| # | Scene (eyebrow) | Content + data binding |
|---|---|---|
| 1 | **Hook** | "Right now, the exact same GPU rents for $LOW an hour on one cloud — and $HIGH on another." LOW/HIGH/multiple = live same-day min/max quoted price for the canonical hero SKU (`getDispersion` / `getOffers`), server-fetched. Renders the real ratio, whatever it is that day. |
| 2 | **01 · The puzzle** | "A GPU-hour should be a commodity." Two price cards = the same two live offers from Scene 1, with real provider labels ("rented on a marketplace" / "rented on a hyperscaler" only if factually the segments those offers are in). |
| 3 | **02 · The method** | "Twice a day, we ask N clouds the same question." N and the provider chip list derived structurally from `getProviders` (active = 5 today; retired TensorDock does not appear here). Offer counter = live total offers, count-up. |
| 4 | **03 · Cleaning up** | Normalization scene as-is (raw name rows → one canonical name). Raw-name examples must be real strings from real payloads (pull from `getRawObservationExplain` samples at build/authoring time, cited in code comment). UNKNOWN-honesty line stays. |
| 5 | **04 · The accounting** (sticky, ~520vh) | Sticky decomposition performance: segments grow as captions advance. Factor shares = live from `getBasisDecomposition` for the hero SKU (market-priced framing consistent with the hero series). Captions name Region → Commitment → Provider → Bundle in the sequential-ANOVA order the API returns; the "all four together: X%" caption interpolates the live tally — no promised "about 40%". Residual reveal = live residual share, in the residual color. |
| 6 | **05 · The finding — REBUILT (the missing act)** | The two-anchor + live-range finding, replacing the old ~60/~82 split. Narrative beat: *"So we threw a 45-feature model at it. Out-of-sample, it still couldn't close the gap — it explains less than the four simple factors claimed in-sample (−10.9pp, as of Jul 31). And of what remains, over half tracks WHO the host is (ICC 0.554, as of Jul 31) — identity, not specs."* Third element in range language: *"The unexplained share in market-priced segments has ranged ~20–61% in recent weeks — segment- and week-conditional."* Anchors bind to `/api/ml/explainability` (gap, ICC, trained date); range language sourced from truth-patch copy. Visual = the negative-gap bound component (§6). |
| 7 | **06 · Why it matters + CTA** | "You can't build financial plumbing on a price you can't explain." Three honesty cards (study-not-product / every-number-has-a-receipt / honest-about-limits) carry over. CTA: "Open the dashboard" → `/` dashboard area (Findings), "Read the methodology →". |

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
| C1 | Scene 1 hook | "Right now, the exact same GPU rents for $LOW an hour on one cloud — and $HIGH on another." + "Same chip. Same memory. A N× difference in price. Basis is an attempt to answer one question: *why?*" | Story §1 |
| C2 | Scene 2 head | "A GPU-hour should be a commodity." | Story §2 |
| C3 | Scene 2 body | "Wheat is wheat. Oil is oil. An H100 is an H100 — the hardware is literally identical. So identical things should cost roughly the same. They don't. Not even close." | Story §2 |
| C4 | Scene 3 head | "Twice a day, we ask five clouds the same question." (count structural) | Story §3, count fixed |
| C5 | Scene 3 body | "'What does an hour of GPU cost right now?' Every answer — every publicly quoted price — is recorded exactly as received and kept forever. No accounts, no scraping tricks, no private data." | Story §3 |
| C6 | Scene 4 head/body | "Every cloud describes the same chip differently." + strict-rules / never-guessed / UNKNOWN-kept-visible lines | Story §4 |
| C7 | Scene 5 captions (6) | Accounting captions, Region → Commitment → Provider → Bundle, with live-tally interpolation; final: "Everything observable, accounted for. And still — a large share of the price has no explanation." | Story §5, tally + hedge fixed |
| C8 | Scene 6 head | "And a bigger model doesn't rescue the story." | NEW |
| C9 | Scene 6 body | "So we threw a 45-feature model at it. Out-of-sample, it still couldn't close the gap — it explains less than the four simple factors claimed in-sample (−10.9pp, as of Jul 31). And of what remains, over half tracks WHO the host is — identity, not specs (ICC 0.554)." | NEW, anchored to truth-patch hero |
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
| C21 | Glossary (tap-to-explain) | one-sentence house-tone definitions: residual, spot, decomposition, ICC | NEW |

> **VOICE PASS (Raj):** mark any row; edits land here and become final.

## 11. Out of scope (restated)

Gamification mechanics · replay→true streaming for Ask (v4) · absolute-variance
companion series (v4) · any new analysis. Also unchanged: no user accounts, no
ML-based normalization, raw observations immutable.

---

## Decisions record

| Decision | Choice | Date | Recorded by |
|---|---|---|---|
| #1 Serif | **Newsreader**, site-wide, one family | 2026-08-02 | Manager (Raj relay) |
| #2 Residual color (ADR-0005 addendum) | **Void near-black `#171512`**; terracotta purely editorial | 2026-08-02 | Manager (Raj relay) |
| #3 Pooled-series visibility | **YES** — teaching exhibit, methodology/Basis area, never landing | 2026-08-02 | Manager (Raj relay) |
| §6 bound-visual candidate | **A** (two bars) w/ in-sample/out-of-sample labels required | 2026-08-02 | Manager (Director ruling) |
| Voice pass | **PENDING** — §10, 21 rows | — | — |
| **Director sign-off** | pending voice pass | — | — |
