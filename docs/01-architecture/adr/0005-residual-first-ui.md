# ADR 0005: Residual-first UI and hand-rolled SVG charts

## Status

Accepted 2026-04-21, implemented on main 2026-05-16.
Amended 2026-08-02 (Stage 6 addendum below): the residual's exclusive color is now
void near-black `#171512`; amber is retired.

## Context

Basis v2's backend decomposes log-price variance into observable factors plus a residual. The v1 frontend, built in Next.js 15 with Tremor for charts, presents this with equal visual weight — residual is "another slice of the donut." That's a quiet contradiction of the thesis: the residual is the finding, and it should dominate every surface that displays a decomposition.

A residual-first prototype (captured in `temp-doc/basis-v2-proposal-r2.md` and the standalone React artifact that produced it) redesigns the dashboard around this principle — residual in amber as a sacred color used nowhere else, factors in muted slate descending by explanatory power, Fraunces serif for display typography, `.page-wide` containers at 1480px, hand-rolled SVG chart primitives. The UI port on the `ui-port-v2` branch translates that prototype into the real codebase.

Before the port goes deep, one architectural choice warrants a decision record: the chart library. The prototype hand-rolls every chart as SVG. The v1 code uses `@tremor/react`. Continuing with Tremor would be cheaper; replacing it is a deliberate constraint that shapes several stages of the port.

## Decision

**Drop `@tremor/react` entirely. Every chart in the port is hand-rolled SVG, styled via Tailwind and CSS variables defined in `globals.css`. Residual color is enforced by the single `--residual` token; it is not used anywhere else in the UI.**

The shape of this decision:

- Chart primitives are typed React components that take structured data and return an SVG. As landed, they are spread across a few locations rather than all under one folder: `frontend/components/charts/DecompBar.tsx` is the shared decomposition bar; `frontend/app/dispersion/DispersionFan.tsx` holds the dispersion fan; and the remaining charts are realized as differently-named components in `frontend/components/` — `BasisDecompositionChart.tsx`, `ResidualTimeSeriesChart.tsx`, `FungibilityMatrix.tsx`, and `DispersionChart.tsx`.
- Colors come from CSS variables (`--residual`, `--factor-provider`, etc.), never hardcoded. Tailwind's `theme.colors` exposes them as named colors so `bg-residual` and `bg-[var(--residual)]` resolve identically.
- No competing chart library. No `recharts`, no `visx`, no `d3` wrapped in a thin React veneer. The charts are few (five primitives) and simple in shape; library overhead is not justified.
- `@tailwindcss/typography` is also removed — the Methodology page is hand-styled rather than served by the `prose` plugin.

## Options Considered

### Option A — Keep Tremor, restyle via Tailwind overrides

**Pros:**
- Smallest diff: only color/font changes, no chart rewrites.
- Tremor handles responsiveness, tooltips, legends out of the box.
- Familiar API; lower risk of chart regressions.

**Cons:**
- Tremor's visual model is library-idiomatic (donut charts with equal slices, legend chips, dual-axis bars). It is not designed around "one slice is the protagonist, everything else is subordinate." Every chart in the port would need deep style surgery that fights the library's defaults, which is often worse than hand-rolling.
- Residual color enforcement is leaky. Tremor accepts a `colors` prop per chart; nothing structurally prevents a contributor from reaching for amber in a non-residual context. With hand-rolled SVGs consuming only the `--residual` CSS variable, a grep over the codebase can confirm the color's discipline — same structural-invariant argument as ADR 0004's import-level guard on `pipeline.py`.
- Tremor's donut visual is the exact wrong shape for the hero decomposition chart. Replacing it with a stacked bar already means leaving the library for the most important chart on the site.
- Peer-dep friction: Tremor 3.18 constrains React to 18, which already forced a React 19→18 downgrade during Phase 5.

### Option B — Drop Tremor, hand-roll SVG (chosen)

**Pros:**
- **Full control over visual hierarchy.** The residual-first stacked bar, amber-intensity heat cells, and dispersion fan are bespoke shapes that read correctly only when their geometry matches the thesis. Hand-rolling them is the shortest path to the design we actually want.
- **Sacred color discipline is structural.** Residual amber lives in exactly one CSS variable and is referenced by exactly one class of primitive. Contributors cannot accidentally import a "residual" color from a chart library's palette.
- **Five primitives, bounded surface.** The port does not need a general-purpose charting library. `DecompBar`, `DispersionFan`, `DeviationBar`, `HeatCell`, `Sparkline` cover every visualization in scope. Each is ~100 lines of SVG. No upgrade treadmill.
- **No library abstraction leak.** Responsive sizing is `viewBox` + `preserveAspectRatio`; themes are CSS variables; data shapes are typed React props matching `frontend/lib/types.ts`. Everything is visible in the component file.

**Cons:**
- **More code to maintain.** Tremor's per-chart API surface is replaced by per-primitive React components. Expected tradeoff; the primitives are simple.
- **Accessibility is our responsibility.** ARIA labels, keyboard focus, color-blind contingencies need to be coded explicitly rather than inherited. Mitigation: use `<title>` on SVGs, non-color signals (glyphs `✓` / `△` / `✕` already in `globals.css`), and focus-visible outlines from the prototype.
- **Visual QA burden is higher.** No library defaults to fall back on; each primitive needs real-data visual review. Mitigation: screenshots committed to `design/` per stage for comparison.

### Option C — Swap Tremor for another library (Recharts, Visx, Nivo, etc.)

**Pros:**
- Keeps a library abstraction; richer default interactions.

**Cons:**
- Every con of Option A carried over (alien visual model, leaky color discipline, abstraction taxes) plus the migration cost of swapping. The alternative libraries are not meaningfully closer to the residual-first aesthetic than Tremor.
- Adds a dependency we do not need at the scale Basis operates.

## Consequences

**Positive:**
- Residual-first visual hierarchy is enforceable by convention and by color grep, not by library-specific style overrides.
- The five chart primitives can be composed across pages without wrapper gymnastics — e.g., the `DecompBar` appears on both the Basis page (hero, height=128) and the Methodology page (compare-to-donut comparison, height=60).
- Chart geometry is auditable. Any reader can open a component file and see exactly how proportions are computed; no library internals to chase.
- `@tailwindcss/typography` also drops out — one less dependency on the upgrade treadmill.

**Negative:**
- More SVG code to write and maintain than the v1 Tremor stack. Acceptable at this project's scale.
- Accessibility semantics — labels, focus indicators, non-color signals — are manual work. The prototype's `globals.css` already provides glyph classes and focus-visible rules; the primitives need to use them deliberately.
- Interactive chart behavior (hover tooltips, click-through) is hand-rolled. Mitigation: keep interactions minimal; where tooltips exist, prefer the native `<title>` SVG element over JS-driven popovers.

**Neutral:**
- The decision is reversible but not cheap to reverse. Going back to a library after the port lands means rewriting every chart. If the scope ever grows past simple geometries — interactive brushing, linked-view selection, animated transitions across datasets — the decision may be worth revisiting.
- The residual-first principle is a visual *and* editorial discipline. The charts enforce the visual half. The editorial half — headlines, eyebrow labels, how copy frames the finding — lives in page components and copy, not in this ADR.

## Addendum — Stage 6 (2026-08-02): the residual's exclusive color

2026-08-02 (Stage 6): the residual's exclusive color is void near-black `#171512`.
It appears wherever the unexplained share is encoded — chart segments, hero
numerals, stat values — and nowhere else. Terracotta `#C15F3C` carries no data
meaning anywhere on the site. The amber residual of the dark theme is retired.

Decision context: Stage 6 design doc §3 (`docs/analysis/stage6-design.md`) — the
cream-editorial retheme keeps this ADR's structural mechanism (one `--residual`
token, hand-rolled SVG consumers, grep-provable discipline) and changes only the
token's value. Terracotta is demoted to purely editorial accent (eyebrows, links,
annotations, active nav) and must never encode data. Ruled by Raj 2026-08-02;
Director concurrence on record in the Stage 6 briefing thread.

## Links

- Residual-first proposal (Revision 2 with Revision 3 retrospective overlay): [`temp-doc/basis-v2-proposal-r2.md`](../../../temp-doc/basis-v2-proposal-r2.md)
- Related ADRs:
  - [ADR 0002 — conservative normalization](0002-conservative-normalization.md): the editorial discipline (don't guess) has a visual cousin here (don't borrow residual amber).
  - [ADR 0004 — parallel explain_* functions](0004-normalization-attribution.md): the "structural invariant over argumental invariant" pattern applies to both the normalization write path and the residual color.
- Code pointers (as of Stage 1):
  - `frontend/app/globals.css` — design tokens + utility classes
  - `frontend/tailwind.config.ts` — theme extension referencing CSS variables
  - `frontend/app/layout.tsx` — shell (sticky header, wordmark, nav, footer, fonts)
  - `frontend/components/layout/Nav.tsx` — active-link handling
  - `frontend/lib/factorColor.ts`, `frontend/lib/gpuFamily.ts`, `frontend/lib/useSku.ts`
- Code pointers (as landed):
  - `frontend/components/charts/DecompBar.tsx` — shared decomposition bar
  - `frontend/app/dispersion/DispersionFan.tsx` — dispersion fan
  - `frontend/components/{BasisDecompositionChart,ResidualTimeSeriesChart,FungibilityMatrix,DispersionChart}.tsx` — the remaining hand-rolled charts
  - `frontend/app/{page,basis,dispersion,providers,methodology}` — page ports
- Prototype reference (not committed): standalone React artifact in `~/Downloads/{styles.css,charts.jsx,page-findings.jsx,page-basis.jsx,page-other.jsx,shell.jsx,app.jsx}`. The ported code diverges where real data contracts demand (URL-param SKU state instead of React context, real API loading/error/empty states, dynamic residual range in hero, etc.); the aesthetic is faithful.
