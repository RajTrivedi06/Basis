---
title: Project Status (TL;DR)
tags: [area:planning, audience:all, status:active]
owner: Raj
last_updated: 2026-04-21
---

# Project Status (TL;DR)

Quick snapshot. For detailed status, see [TASKS/README.md](TASKS/README.md). For the phase plan, see [roadmap.md](roadmap.md). For what Basis is, see [project-brief.md](project-brief.md).

## Current phase

**Basis v1 complete.** Phases 0–6 shipped. Phase 7 (deploy) deferred by design.

**Basis v2 in progress.** Phase A shipped on 2026-04-21. Proposal: [temp-doc/basis-v2-proposal-r2.md](../temp-doc/basis-v2-proposal-r2.md).

**UI port in progress on the `ui-port-v2` branch.** A residual-first redesign of the frontend — drop Tremor, hand-roll SVG charts, Fraunces/Inter/JetBrains Mono typography, amber-residual discipline. Decision: [ADR 0005](01-architecture/adr/0005-residual-first-ui.md). Stage 1 (tokens + fonts + shell + utilities) is shipped on the branch; pages still render v1 content with v1 colors and v1 charts until Stages 2+ port them. Not merged to main until the port is end-to-end consistent.

## v2 progress

| Phase | Scope | Status |
|-------|-------|--------|
| A | Residual-first landing + fungibility matrix | ✅ Shipped 2026-04-21 |
| B | Provenance drilldown (parallel `explain_*` functions) | ✅ Shipped 2026-04-21 |
| C | Slice interactivity | ⬛ Skipped 2026-04-21 — see [`temp-doc/phase-c-scoping.md`](../temp-doc/phase-c-scoping.md) |
| D | Rolling stability view | 🔲 Blocked on ≥30 days of cron data (earliest meaningful start ~2026-05-17) |
| UI port | Residual-first redesign (ADR 0005) | 🟡 Stage 1 of 7 shipped on `ui-port-v2`; Stages 2+ (chart primitives, page ports, cleanup, visual QA) pending |

## Data at a glance (2026-04-20)

- **4 collectors live:** Vast.ai, RunPod, AWS Spot, TensorDock. (Lambda Labs dropped — ADR 0003.)
- **Raw observations:** 9,979 cumulative (Vast 8,417 / AWS Spot 897 / RunPod 564 / TensorDock 101).
- **Canonical offers:** 9,979 across 97 unique GPU SKUs.
- **Daily aggregates:** 465 rows across 3 collection days.
- **Decompositions:** 179 rows (one per date, GPU SKU).
- **Schedule:** cron 08:00 + 20:00 via `backend/collect_cron.sh` (now runs collect → normalize → analytics).
- **H100 SXM residual variance:** **53% – 95%** of total variance is unexplained by region / commitment / provider / bundle — the headline Basis finding.

## Phase status table

| # | Phase | Status |
|---|-------|--------|
| 0 | Scaffold | ✅ Complete |
| 1 | Data Collection | ✅ Complete (4/5 providers) |
| 2 | Normalization | ✅ Complete |
| 3 | Analytics | ✅ Complete |
| 4 | API Endpoints | ✅ Complete (6 endpoints live) |
| 5 | Frontend Dashboard | ✅ Complete (4 pages, 3 charts) |
| 6 | Analytical Writeup & Polish | ✅ Complete |
| 7 | Deploy | 🔲 Deferred (by design) |

## Ongoing / post-Phase-6

1. **Keep cron running.** Residual estimates stabilize with ≥30 days. The writeup at [findings.md](findings.md) acknowledges the 3-day sample; numbers will be refreshed as data accumulates.
2. **Watch `skipped_unknown_gpu`** in `run_normalize.py` output — a new GPU name from any provider will require adding to `canonicalize.py`.
3. **Phase 7 (deploy)** is deferred by design. Triggered by a decision to publish the dashboard publicly.

## Update log

- 2026-04-21 — UI port kicked off on `ui-port-v2` branch. Baseline commit on main (`7776ae5`) captures pre-port state. Stage 1 shipped on the branch: ~60 CSS design tokens + utility classes in `globals.css`, next/font/google loads Fraunces + Inter + JetBrains Mono as variable fonts, new sticky-blurred TopBar with serif wordmark + "v2 · research" eyebrow, flat nav with underline-active, footer, Tailwind config rewritten (Tremor glob + typography plugin dropped, tokens exposed as named colors), `useSku` hook (URL search params), `factorColor` + `gpuFamily` utilities. One in-session fix: container padding restored on `<main>` (dropped in the initial rewrite, causing v1 page content to bleed to viewport edges). Pages still render v1 content — dissonant with the new shell; gets resolved as Stages 2+ port them. Decision captured as ADR 0005 (Proposed). Screenshots under `design/pre-port-baseline/` + `design/stage-1-fixed/` for comparison.
- 2026-04-21 — Pipeline offset/filter bug fixed in `backend/basis/normalization/pipeline.py` (cursor-based pagination via `id > last_id`; advances reliably across skipped-unknown-GPU batches, which pure offset-removal would have infinite-looped on). Regression test added. Backfill verification: zero silent data loss in current DB (eligible=9979, canonical=9979). Full suite: 20 passed / 4 skipped.
- 2026-04-21 — Between-phase session: 19-test suite backfilled (fidelity / analytics integrity / API smoke + fixture-gated collector parse tests); country-code normalization fixed in `region.py` (TensorDock full-name → ISO-2); canonical offers + analytics regenerated; residual shifts all < 0.005pp across 179 decomposition rows. Pre-existing pipeline offset bug discovered and flagged; fixed in the following session.
- 2026-04-21 — v2 Phase C skipped. Rationale in [`temp-doc/phase-c-scoping.md`](../temp-doc/phase-c-scoping.md). ADR 0005 not pursued; no code footprint.
- 2026-04-21 — v2 Phase B shipped: three new endpoints (`/api/decomposition/{sku}/observations`, `/api/raw-observation/{id}`, `/api/raw-observation/{id}/explain`), parallel `explain_*` functions in all four normalization modules, AST guard test on `pipeline.py` enforcing ADR 0004, `ObservationsDrawer` + `RawObservationInspector` frontend components surfaced from `/basis`.
- 2026-04-21 — ADR 0004 (parallel `explain_*` functions for normalization attribution) accepted. Unblocks v2 Phase B implementation.
- 2026-04-21 — v2 Phase A shipped: `/api/fungibility-matrix` endpoint, `FungibilityMatrix` landing-page hero, `BasisDecompositionChart` rebuilt residual-first (donut removed, hero stat + thin stacked bar). Hardcoded 3-day table dropped from `/`.
- 2026-04-20 — Phase 6 complete: findings.md (~1200-word analytical piece) written; frontend restructured (`/` → findings, `/dispersion` → old home); README rewritten to lead with the finding.
- 2026-04-20 — Phase 5 complete: frontend dashboard shipped (dispersion / basis / providers / methodology); React 18 + Tremor + React Query; build passes, all pages + proxied APIs return 200.
- 2026-04-20 — Phase 4 complete: 6 REST endpoints live (health, offers, dispersion, basis, providers, gpu-skus) returning real data from canonical/aggregate tables.
- 2026-04-20 — Phase 3 complete: dispersion + decomposition shipped; cron chained; first findings computed.
- 2026-04-20 — converted to TL;DR; detailed status lives in TASKS/README.md.
- 2026-04-20 — initial status doc after Phase 2 completion.
