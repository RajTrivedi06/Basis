# Stage 6 References — Frozen Editorial Art Direction

Reference designs for the Stage 6 retheme + scrollytelling landing. Committed per
Task 6.0a (Director briefing, 2026-08-02). The direction is **frozen**: cream
editorial, serif statements, mono data labels, numbered nav 01–06, terracotta
accent. No further exploration.

## THE QUARANTINE RULE

> The reference designs in `design/stage6-references/` are the spec for layout,
> motion, and tone ONLY. Every number, provider list, chart shape, and finding
> comes from the live API or truth-patch copy. Any reference component that
> cannot render the TRUE result (negative gap, live ranges, 5 providers, retired
> TensorDock) gets redesigned — never the reverse. Charts render real data's
> real shape: no idealized curves.

This rule appears verbatim in every Stage 6 dev prompt. Known untruths baked
into these references (do NOT carry any of them over): 4 providers with
TensorDock active · "four clouds" · 60.3% residual · ~60% / ~82% two-figure
finding · positive ML gap (+28.1pp / +31pp) · fabricated factor shares ·
idealized smooth chart curves · invented offer counts and provider deltas.

## What is authoritative for what

### `dc/` — implementation reference (scroll/reveal/sticky logic, scene structure)

| File | Use it for |
|---|---|
| `dc/Basis Story.dc.html` | The scrollytelling landing: 7-scene structure, IntersectionObserver reveal pattern, sticky 520vh decomposition scene w/ scroll-progress→segment-width mapping, caption crossfade timing, count-up easing (cubic ease-out), `prefers-reduced-motion` handling (keep it), fixed blurred header, footer. Scene 6 content is REBUILT per design doc §5 — only its layout skeleton survives. |
| `dc/Basis Story Mobile.dc.html` | Mobile adaptation of the story scenes. |
| `dc/Basis Redesign.dc.html` | Dashboard/interior framing: numbered pill nav, PUBLIC DATA chip, card/table styling, section eyebrows. |
| `dc/Basis Dashboard Mobile.dc.html` | Mobile adaptation of the dashboard shell. |
| `dc/support.js`, `dc/_ds/` | Design-tool runtime only. Never port; not part of the spec. |

Palette in the DC files: bg `#FAF9F5` · surface `#FFFFFF` · ink `#1F1D1A` ·
mid `#6B675E` · dim `#A09B90` · lines `#E8E4DB` · terracotta `#C15F3C`.
Serif: Newsreader (Google Fonts). Sans: system stack. Mono: ui-monospace stack.

### `Basis_Explorations_dc.html` — APPROVED component explorations (Director picks, 2026-08-03, binding)

Authoritative source for four components; the picks are recorded in the design
doc (§14 as amended) and implemented as Task 6.3c:

- **Bracket mark — variant 1c "The mark is the measurement":** the site monogram
  AND nav lockup (bracket + "Basis" wordmark per 1c's desktop frame). Scene head
  "The gap has a name."; single footnote caption from 1b: "Recorded, never
  modeled." Motion: bracket draws once, top tick → bottom tick, label stamps,
  nothing loops.
- **Decomposition — variant 1e "ledger + depletion":** the ONE waterfall
  component used everywhere (landing Scene 5 + Basis page; 1d does NOT ship in
  parallel). Per-row depletion bars are Scene 5's scroll-scrub target.
- **Dispersion band:** approved as shown (crosshair + mono readout, p25/p75 edge
  hairlines, stronger band, "today's disagreement" bracket). **HARD RIDER:
  production renders the real series' real jaggedness — the mock's smooth
  curves are placeholder only.**
- **Beeswarm — variant 1h inline receipt** (44px touch targets). RIDER: inline
  insertion must not jump scroll position. Variant 1i bottom-sheet is the
  sanctioned 6.4 fallback, decided by feel on a real phone, not re-litigated.

Every `$ ·.·· LIVE` placeholder in this file binds to the API (Quarantine Rule);
the waterfall's "X left" arithmetic computes from live shares, never hardcoded.

### `screenshots/` — copy/layout reference where stronger than the DC files

| File | Authoritative for |
|---|---|
| `methodology-hero.png` | **Methodology hero: "Measuring what the market cannot explain."** + stat strip row (n providers · 2× daily · Sequential ANOVA · residual figure) + numbered left-rail section index. The heavier didone hero numerals are Raj decision #1's second candidate. |
| `findings-hero.png` | **Findings hero layout + stat strip** (Offers / Canonical SKUs / Providers) and the SKU interchangeability table treatment. The two-figure ~60/~82 finding it shows is superseded by the two-anchor truth-patch finding. |
| `basis-decomposition.png` | Decomposition bar + factor table (SHARE / CUMULATIVE / INTERPRETATION / Inspect) + "Price by factor" strip-plot layout + contributing-observations drawer. |
| `explainability.png` | Bound exhibit layout (three-segment bar + three stat cards + per-provider R² chips + SHAP bars + host-identity stat row). NOTE: assumes gap ≥ 0 — cannot render the true negative gap; component gets redesigned per design doc §6. |
| `providers.png` | Providers table layout + deviation-metric / marketplace-caution footnote pattern. "Four providers, four postures." headline is count-dependent — derive count structurally. |
| `dispersion.png` | Dispersion page layout + "How to read this chart" footer pattern. |
| `thumb-*.png` | Small 2-up overviews of the same pages; use the full-page shots above. |
