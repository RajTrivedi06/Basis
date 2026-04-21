---
title: Basis v2 — Residual-First Proposal (Revision 2)
tags: [area:planning, audience:all, status:draft]
owner: Raj
last_updated: 2026-04-21
supersedes: basis-v2-proposal.md (Revision 1)
---

# Basis v2 — Residual-First Proposal (Revision 2)

## Revision 3 retrospective note (2026-04-21)

This marker is a retrospective overlay on the Revision 2 text below — the body is preserved as-written rather than rewritten. Outcomes since Revision 2:

- **Phase A shipped 2026-04-21.** Fungibility matrix + residual-first landing live.
- **Phase B shipped 2026-04-21.** Provenance drilldown live. ADR 0004 (parallel `explain_*` functions) accepted and enforced by an AST guard test on `backend/basis/normalization/pipeline.py`.
- **Phase C skipped 2026-04-21.** Decision and rationale captured in [`phase-c-scoping.md`](phase-c-scoping.md). ADR 0005 is not pursued. No `POST /api/slice`, no `sliced_decompositions` table, no slice-builder components. The Revision 2 text below describing Phase C remains for record but is not the current plan.
- **Phase D gated on data.** Still blocked on ≥30 days of cron data; the earliest meaningful start is ~2026-05-17.

Revision 2 text follows.

## Revision note

This revision supersedes Revision 1 in response to external review. The core feature direction is unchanged; the phasing, scope boundaries, and architectural commitments are tightened.

Principal changes:

- **Feature 1 split.** The original Feature 1 bundled a fungibility matrix, slice builder, and residual-first decomposition chart into one "week-long" deliverable. Revision 2 scopes Feature 1 down to the matrix + residual-first landing only, and moves slice interactivity to a new Feature 4 that requires an ADR before it ships.
- **Verdict labels deferred.** The "benchmarkable / marginal / insufficient" verdict is removed from MVP. It will be revisited once rolling data exists to support it, not with three-day snapshots.
- **Analytics/API boundary enforced.** The original proposal would have run `analytics/dispersion.py` and `analytics/basis.py` at request time behind a new `POST /api/slice`. Revision 2 forbids this path and names two acceptable architectures for slice interactivity, to be decided via ADR.
- **Phasing restated as four phases (A–D).** Each phase is independently shippable. Phase A can ship in 2–3 days without any new infrastructure.
- **`explain=True` refactor flagged as boundary-sensitive.** It remains the right change but is now named as a deliberate layer adjustment warranting its own ADR.

## Summary

Basis v1 is feature-complete and produces a real, defensible finding: 53–95% of H100 SXM log-price variance is unexplained by observable factors. The dashboard leads with prices, not with the residual, and presents the finding as a three-day snapshot rather than an ongoing measurement. This proposal describes additive features that reposition the project around its actual differentiator — residual as the protagonist — and convert it from a snapshot study into an audited, longitudinal measurement.

The features, now organized as four phases:

- **Phase A: Residual-first landing + fungibility matrix.** Make the homepage demonstrate the thesis. No new infrastructure.
- **Phase B: Provenance drilldown.** Surface the raw→canonical audit trail the schema already supports.
- **Phase C: Slice interactivity.** Per-SKU filtering. Requires an architectural decision (ADR) before implementation.
- **Phase D: Rolling stability view.** Time-series of the residual. Gated on ≥30 days of accumulated data.

All four phases respect the invariants in `AGENTS.md`: read-only, no new top-level directories, no ML, no auth, no SaaS drift, rule-based normalization preserved.

## Motivation

Three gaps in v1 motivate this proposal.

**The dashboard doesn't demonstrate the thesis.** `docs/findings.md` is explicitly residual-centric — the hero claim is that most price variance is unexplained. But a visitor landing on the dashboard sees price charts first and has to read the writeup to understand why those charts matter. The charts support the thesis; they don't *show* it.

**The system's credibility is invisible.** The FK from `canonical_offers` to `raw_observations` is the single most important architectural decision in the project — it's what makes every normalized number auditable. Right now that audit trail is a claim in `AGENTS.md` and a database invariant; it's not something anyone using the dashboard can see or interrogate.

**The sample is three days.** The project's own writeup acknowledges the residual estimates will stabilize with more data. The cron has been running since 2026-04-17 and continues to accumulate; without a view that exploits the longitudinal dimension, the project looks like a snapshot study rather than an ongoing measurement.

## Non-goals

Explicitly out of scope, consistent with `AGENTS.md`:

- User accounts, authentication, multi-tenancy, alerting.
- ML-based normalization, slice scoring, or regime detection.
- Transaction simulation or derivatives pricing.
- New top-level directories.
- New infrastructure (monitoring frameworks, task queues, caches).
- Edit-from-UI flows. All additions are read-path.
- **New in Revision 2:** Moving analytics computation into request-time API code paths. The API reads aggregates; it does not compute them.

## Architectural principles (new in Revision 2)

Two principles govern this proposal, derived from `docs/01-architecture/system-overview.md`:

1. **The read-path/write-path separation is non-negotiable.** Collectors write raw. Normalization writes canonical. Analytics writes aggregates. The API reads aggregates. A feature that requires the API to compute analytics at request time is a feature that requires a precomputation strategy first.
2. **Boundary-crossing changes require ADRs.** If a feature adds behavior to a layer to support a consumer in a different layer, the change is boundary-sensitive and deserves an explicit decision record. The `explain=True` refactor in Phase B is an example.

## Phase A — Residual-first landing + fungibility matrix

### What it is

The homepage repositions around the finding. Two changes:

- **Fungibility Matrix as hero element.** Table or heatmap. One row per canonical SKU, columns for median price, latest residual %, sample size, provider count. Sortable. Single screen answer to "which GPUs are actually fungible?"
- **Residual-first decomposition chart.** The existing `BasisDecompositionChart.tsx` rebuilt so residual is the dominant visual element and the four explained factors are muted, rather than equal donut slices. Used on the Basis page, which is unchanged in routing.

Explicitly **not** in Phase A:
- Slice filtering. Moved to Phase C.
- Benchmarkability verdicts. Deferred pending rolling data.
- Residual Explorer page. Folded into the matrix — sorting by residual % *is* the explorer.

### Why this phase

It's the minimum change that corrects the thesis-vs-dashboard mismatch. It requires no new endpoints beyond a single aggregate-reading query, no schema changes, and no architectural decisions. It's shippable in a few focused days and delivers the most visible uplift.

### Data model impact

None.

### Backend

One new endpoint:

- `GET /api/fungibility-matrix` — one SQL query joining `daily_aggregates` and `basis_decomposition` on `(date, gpu_sku)`, filtered to latest date per SKU. Returns one row per SKU. Reads aggregates only; does not invoke analytics functions.

### Frontend

- New `frontend/app/page.tsx` landing — replace current finding-summary with the matrix as the hero; keep the existing finding text below as context.
- New `frontend/components/FungibilityMatrix.tsx`.
- Rebuild `frontend/components/BasisDecompositionChart.tsx` so residual leads visually. Retain existing usage sites.
- Extend `frontend/lib/api.ts` and `frontend/lib/types.ts` for the new endpoint.

### Risks and mitigations

- **Matrix looks thin with few qualifying SKUs.** Mitigation: graceful "accumulating" state for SKUs below the 5-observation decomposition threshold; present as honest rather than empty.
- **Sorting by residual % when some rows are `NULL` residual.** Mitigation: sort nulls last, show them with explicit "accumulating" label.

### Effort estimate

Two to three focused days. Breakdown:

- Backend matrix endpoint: 0.5 day
- Frontend matrix component: 1 day
- Frontend landing page restructure: 0.5 day
- Decomposition chart rebuild: 0.5 day

## Phase B — Provenance drilldown

### What it is

End-to-end drilldown from any aggregate row to the provider's raw snapshot, with rule-level attribution of normalization decisions. Three levels:

- **Aggregate → canonical offers.** From any decomposition row, view the canonical offers that went into it. Each row surfaces `UNKNOWN` factor values explicitly rather than hiding them.
- **Canonical → raw observation.** View the original `raw_payload` JSONB alongside the canonical row.
- **Normalization decisions.** Narrative trail showing which lookup table entry produced each canonical value — e.g., `gpu_model_reported "H100 SXM5 80GB"` → `canonicalize.py` lookup → `h100_sxm_80gb`.

### Why this phase

The FK relationship between `canonical_offers` and `raw_observations` is the architectural spine of the project. Drilldown makes that spine visible. It turns an implementation detail into evidence — specifically, evidence that normalization is rule-based and auditable, which is the credibility claim the project rests on.

This is the cleanest of the four phases because it exposes a property the system already has, rather than adding new capability.

### Data model impact

None.

### Backend

Three new endpoints and a layer refactor:

- `GET /api/decomposition/{gpu_sku}/observations?date=YYYY-MM-DD` — returns canonical offers for the bucket.
- `GET /api/raw-observation/{id}` — returns the raw row including full `raw_payload`. Truncation or pagination on large payloads.
- `GET /api/raw-observation/{id}/explain` — runs the raw row back through normalization in explain mode, returns the decision trail.

**Boundary-sensitive refactor, requires ADR:** add an optional `explain=True` mode to each of `canonicalize.py`, `commitment.py`, `region.py`, `bundle.py`. In explain mode, return `(value, rule_applied)` tuples instead of just the value. This forces the normalization layer to know *why* it did what it did. The ADR should capture: (a) the read-path motivation, (b) the invariant strengthening (normalization knows its own reasoning), (c) the commitment to keep explain mode a pure read — it must never be invoked during the canonicalization write path.

### Frontend

- Drawer or modal component surfaced from the Basis decomposition page — `frontend/components/ObservationsDrawer.tsx`.
- Raw observation inspector — `frontend/components/RawObservationInspector.tsx`. Side-by-side raw JSON + canonical row + decision narrative.
- Extend `frontend/lib/api.ts` and `frontend/lib/types.ts`.

### Risks and mitigations

- **Raw payloads can be large.** Mitigation: truncate in default view with a "show full" toggle.
- **Rule attribution must be accurate.** Mitigation: the `explain=True` refactor returns attributions from the actual lookup code, not a best-guess reconstruction. If a mapping can't be cleanly attributed, return `null` rather than a guess.
- **Refactor could leak into the write path.** Mitigation: `explain=True` defaults off; the canonicalization pipeline never sets it; test coverage asserts explain-mode calls originate only from API routes.

### Effort estimate

Three to four focused days, plus a short ADR. Breakdown:

- ADR for the `explain=True` convention: 0.5 day
- Backend observations-for-decomposition endpoint: 0.5 day
- Backend raw-observation endpoint: 0.25 day
- Normalization `explain=True` refactor (four modules + tests): 1 day
- Backend explain endpoint: 0.5 day
- Frontend observations drawer: 1 day
- Frontend raw observation inspector: 1–2 days

## Phase C — Slice interactivity

### What it is

Per-SKU interactive filtering. User narrows by commitment type, region, provider, verification tier. Live-updating residual %, sample size, and decomposition chart for the filtered subset.

**Explicitly deferred from Phase C until Phase D data exists:** benchmarkability verdicts ("benchmarkable / marginal / insufficient"). The label asserts more confidence than three days of snapshots can support. Once rolling residuals stabilize over 30+ days, thresholds become defensible and the verdict can be added in a follow-up.

### Why this phase requires an ADR

The original proposal would have implemented slice interactivity via a `POST /api/slice` endpoint that invokes `analytics/dispersion.py` and `analytics/basis.py` against filtered `canonical_offers` at request time. This blurs the read-path/write-path separation: the API becomes a thin wrapper over an on-demand analytics engine, and the analytics layer gains a second, implicit caller with different performance characteristics.

Two architectures preserve the boundary. Both are viable; the choice should be recorded as an ADR before Phase C begins.

**Option 1 — Precomputed slice table.** Extend the analytics pipeline to emit pre-sliced decompositions for a documented set of slice axes (e.g., `(sku, commitment)` and `(sku, commitment, region_country)`). Store in a new `sliced_decompositions` table. The API reads from there. Slices outside the precomputed set are not offered. Trade-off: combinatorial explosion is bounded by design, but the set of allowed slices is fixed at pipeline time rather than at query time.

**Option 2 — Client-side composition over existing aggregates.** The API exposes the full set of `basis_decomposition` rows (already small: ~179 rows at current volumes). The frontend composes slice views by filtering and recombining. Trade-off: no new backend work, but slice expressiveness is limited to what `basis_decomposition` already stores — i.e., slices across date and SKU, not across commitment or region.

Option 1 is more expressive but adds a table and a migration. Option 2 is lighter but restricts the feature. The ADR captures the trade-off and the decision.

### Data model impact

Option 1: new `sliced_decompositions` table, migration. Option 2: none.

### Backend and frontend

Design depends on the ADR outcome. Either:

- **Option 1:** new analytics module `analytics/slices.py`, new table, new endpoint `GET /api/sliced-decomposition/{gpu_sku}?commitment=X&region=Y`, frontend filter UI that constrains selections to the precomputed axes.
- **Option 2:** new endpoint `GET /api/basis/all?gpu_sku=X` returning all decomposition rows for a SKU, frontend does composition.

### Risks and mitigations

- **Combinatorial explosion in Option 1.** Mitigation: document the precomputed axis set in the ADR; review quarterly.
- **Frontend composition logic becoming analytics-by-stealth in Option 2.** Mitigation: limit client-side work to filtering and display of precomputed rows; no log-price math, no ANOVA, no weighting.

### Effort estimate

Not estimated until ADR is decided. Expect 4–6 days for Option 1, 2–3 days for Option 2.

## Phase D — Rolling stability view

### What it is

Time-series treatment of the residual finding, built on top of the `basis_decomposition` table the cron populates daily. Three components:

- **Rolling residual line.** Per-SKU line chart of residual % over time, with 7-day and 30-day rolling means and a ±1σ confidence band.
- **Regime markers.** Points on the line where the rolling mean shifts by more than a documented threshold. Flags "something changed," does not claim causal explanation.
- **Factor stability small-multiples.** Four tiny line charts — one per observable factor — showing variance-explained over time.

A separate, manually curated event log (YAML file in the repo) can be overlaid as annotations for known market events. Curated attributions are kept explicitly separate from algorithmic regime detection.

### Why this phase is last

Rolling means need rolling windows. Confidence bands need variance estimates. Regime detection needs enough data to distinguish a shift from noise. Shipping this with three days of data would produce a visually empty chart and numbers that look authoritative but aren't. The project's own documentation says residual estimates stabilize with ≥30 days; shipping rolling views before that threshold would *weaken* the project, not strengthen it.

This phase is the narrative closer — the piece that converts the dashboard from "I analyzed some data" to "I'm running an ongoing study." It earns its place only after the cron has run long enough for the numbers to be real.

### Data model impact

None. `basis_decomposition` already stores one row per `(date, gpu_sku)`; the rolling view is a query over existing data.

### Backend

- `GET /api/basis/{gpu_sku}/timeseries` — returns per-date decomposition rows for the SKU, plus computed rolling means, rolling variance, and per-factor variance-explained ratios. Regime markers computed in the same endpoint.
- Small helper in `backend/basis/analytics/` for rolling-window math and regime detection.
- Event log: static file at `docs/events.yaml`, loaded at endpoint time.

Note: this endpoint does *not* run decomposition at request time. It reads existing `basis_decomposition` rows and applies rolling aggregation. That is a display transformation, not an analytics operation.

### Frontend

- Rolling residual chart — Tremor line + confidence band + regime markers.
- Factor stability small-multiples — four small line charts.
- Event annotations rendered on the rolling chart where applicable.

### Risks and mitigations

- **Confidence bands can mislead on thin days.** Mitigation: weight by sample size or show sample size alongside the chart; document the rule.
- **Regime threshold is a magic number.** Mitigation: document threshold in `docs/methodology.md`, expose in UI, justify choice.
- **Rolling windows need a minimum-n rule.** Mitigation: specify and document behavior for days with insufficient data (preferred: skip with visible gap).
- **Regime markers invite causal interpretation.** Mitigation: keep algorithmic detection visually and semantically distinct from curated event annotations.

### Effort estimate

Four to five focused days, once data is sufficient.

## Sequencing summary

| Phase | Scope | Blocking dependency | Effort |
|-------|-------|--------------------|--------|
| A | Residual-first landing + fungibility matrix | None | 2–3 days |
| B | Provenance drilldown | ADR for `explain=True` | 3–4 days |
| C | Slice interactivity | ADR for slice architecture | 2–6 days (depends on ADR) |
| D | Rolling stability view | ≥30 days of cron data | 4–5 days |

Phases A and B can ship in any order once A's ADR-free path is taken. Phase C is gated on architectural decision. Phase D is gated on data volume.

If motivation drops at any point, each preceding phase stands alone. Phase A alone corrects the thesis-vs-dashboard mismatch. Phase A + B is a complete "residual-first audited dashboard." Phase A + B + D (skipping C) is also coherent — slice interactivity is the most deferrable piece.

## Combined narrative after all four phases ship

The dashboard tells a three-act story:

- **Act 1 (Phase A):** *Here is the current state of GPU fungibility, measured by residual.*
- **Act 2 (Phase B):** *Here is how I know — every number traces to a provider snapshot via documented rules.*
- **Act 3 (Phase D):** *Here is how it's changing — this is an ongoing measurement, not a one-off.*

Phase C adds interactivity within acts 1–3 but isn't its own act.

## Invariant check

All phases respect the non-negotiables in `AGENTS.md`:

- Raw observations remain immutable. Drilldown is read-only.
- All timestamps UTC, all prices USD/GPU/hour. No changes.
- Every collector still inherits from `BaseCollector`. No new collectors.
- Normalization remains rule-based. The `explain=True` refactor adds attribution, not new rules.
- No new top-level directories.
- No user accounts, no auth, no multi-tenancy, no derivatives simulator.
- No ML.
- **API reads aggregates, does not compute them.** Preserved by deferring slice interactivity to Phase C and requiring an ADR; preserved by framing the rolling-view endpoint as a display transformation over existing decomposition rows.

## Open questions

1. **Slice architecture (Phase C).** Option 1 (precomputed table) or Option 2 (client-side composition)? Decision captured as ADR before Phase C work begins.
2. **`explain=True` convention (Phase B).** ADR needed to record the read-path motivation, the invariant strengthening, and the commitment that explain mode never runs during the canonicalization write path.
3. **Regime detection threshold (Phase D).** Proposed: two-sigma shift in the 7-day rolling mean. Alternative: fixed percentage-point threshold (e.g., 15 pp).
4. **Minimum-n rule for rolling windows (Phase D).** Proposed: include a day only if it has ≥5 canonical offers for the SKU; days below the threshold leave a visible gap.
5. **Event log format and location (Phase D).** Proposed: `docs/events.yaml` with fields `{date, title, description, affected_skus, source_url}`.

Dropped from Revision 1:
- ~~Verdict thresholds for Slice Builder~~ — verdicts deferred out of MVP pending rolling data.

## Related

- [Project brief](project-brief.md)
- [System overview](01-architecture/system-overview.md)
- [Roadmap](roadmap.md)
- [TASKS](TASKS/README.md)
- [Methodology](methodology.md)
- [Findings](findings.md)
- [ADR-0002 — conservative normalization](01-architecture/adr/0002-conservative-normalization.md)
- Basis v2 Revision 1 (superseded): `basis-v2-proposal.md`
