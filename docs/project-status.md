---
title: Project Status (TL;DR)
tags: [area:planning, audience:all, status:active]
owner: Raj
last_updated: 2026-04-28
---

# Project Status (TL;DR)

Quick snapshot. For detailed status, see [TASKS/README.md](TASKS/README.md). For the phase plan, see [roadmap.md](roadmap.md). For what Basis is, see [project-brief.md](project-brief.md).

## Current phase

**Basis v1 complete.** Phases 0–6 shipped. Phase 7 (deploy) is in progress — EC2 infrastructure shipped 2026-04-27 via [basis-deployment-roadmap.md](basis-deployment-roadmap.md) Phases 0–6; public deploy (Caddy + Vercel + DNS) is pending UI polish (1–2 weeks).

**Basis v2 in progress.** Phase A shipped on 2026-04-21. Proposal: [temp-doc/basis-v2-proposal-r2.md](../temp-doc/basis-v2-proposal-r2.md).

**UI port in progress on the `ui-port-v2` branch.** A residual-first redesign of the frontend — drop Tremor, hand-roll SVG charts, Fraunces/Inter/JetBrains Mono typography, amber-residual discipline. Decision: [ADR 0005](01-architecture/adr/0005-residual-first-ui.md). Stage 1 (tokens + fonts + shell + utilities) is shipped on the branch; pages still render v1 content with v1 colors and v1 charts until Stages 2+ port them. Not merged to main until the port is end-to-end consistent.

## Production state

EC2 deployment shipped 2026-04-27. Phases 0–6 of [basis-deployment-roadmap.md](basis-deployment-roadmap.md) are complete; Phases 7–9 remain. Phase 7 (public deploy via Caddy + Vercel + DNS) waits on UI polish (1–2 weeks); Phase 8 covers the post-deploy reboot test, weekly checks, and a mid-May findings refresh; Phase 9 is the eventual shutdown procedure.

- **Compute.** AWS EC2 t3.small, Ubuntu 24.04, Elastic IP `52.70.173.217`, region `us-east-1`. 2 GiB swap file at `/swapfile`, persisted via `/etc/fstab`.
- **IAM.** Role `basis-ec2-role` with two inline policies: `basis-spot-read` (`ec2:DescribeSpotPriceHistory`) and `basis-s3-backup` (`s3:PutObject` / `GetObject` / `DeleteObject` on `arn:aws:s3:::basis-backups-rajt-2026/*`, plus `s3:ListBucket` on the bucket). Collectors and backup script use the default credential chain — no AWS keys in the EC2 `.env`.
- **Backups.** S3 bucket `basis-backups-rajt-2026` in `us-east-1` — versioning on, 90-day lifecycle (current expiry + permanent noncurrent delete), Block Public Access on, SSE-S3.
- **Automation (systemd).** `basis-postgres.service` (oneshot at boot) brings Docker compose Postgres up. Three timers run the work: `basis-collect.timer` (`08:00` + `20:00` UTC), `basis-backup.timer` (`03:00` UTC), `basis-data-fresh.timer` (top of hour). All timers `Persistent=true` with `RandomizedDelaySec`.
- **Monitoring.** Three healthchecks.io endpoints on the alert path: `basis-collect` (cron `0 8,20 * * *`, 30 min grace), `basis-backup` (cron `0 3 * * *`, 1 hr grace), `basis-data-fresh` (period 1 hr, 14 hr grace — a single missed collection alerts ~14 h later).
- **Database.** Docker compose Postgres bound to `127.0.0.1:5433`, healthcheck-gated.
- **Production env.** `/home/ubuntu/Basis/.env`, mode `600`. Holds `DATABASE_URL`, `POSTGRES_PASSWORD`, `ENVIRONMENT=prod`, `AWS_DEFAULT_REGION`, `CORS_ORIGINS`, and the three `HC_*_PING_URL` values.
- **Domain.** `gpu-basis.xyz` registered at Namecheap; DNS not yet pointed (Phase 7 work).

For deploy-day procedure, see [basis-deployment-roadmap.md](basis-deployment-roadmap.md). Day-to-day operations live in [guides/operations-runbook.md](guides/operations-runbook.md).

## v2 progress

| Phase | Scope | Status |
|-------|-------|--------|
| A | Residual-first landing + fungibility matrix | ✅ Shipped 2026-04-21 |
| B | Provenance drilldown (parallel `explain_*` functions) | ✅ Shipped 2026-04-21 |
| C | Slice interactivity | ⬛ Skipped 2026-04-21 — see [`temp-doc/phase-c-scoping.md`](../temp-doc/phase-c-scoping.md) |
| D | Rolling stability view | 🔲 Blocked on ≥30 days of cron data (earliest meaningful start ~2026-05-17) |
| UI port | Residual-first redesign (ADR 0005) | 🟡 Stage 1 of 7 shipped on `ui-port-v2`; Stages 2+ (chart primitives, page ports, cleanup, visual QA) pending |

## Data at a glance (2026-04-27)

- **4 collectors live:** Vast.ai, RunPod, AWS Spot, TensorDock. (Lambda Labs dropped — ADR 0003.) All four hit on every run since the vast.ai retry fix.
- **Raw observations on EC2:** 6,880 across the 4 providers since the 2026-04-27 cutover. A separate 33,525-row Mac snapshot was frozen the same day as pre-EC2 history; new collection only writes to EC2.
- **Canonical offers:** 6,880 (1:1 normalization, 0 skips).
- **Daily aggregates:** 393 rows.
- **Decompositions:** 143 rows.
- **Schedule:** systemd timers on EC2 — collect at `08:00 + 20:00` UTC, backup at `03:00` UTC, hourly freshness probe. The Mac cron (`backend/collect_cron.sh`) is stopped.
- **H100 SXM residual variance:** **53% – 95%** of total variance is unexplained by region / commitment / provider / bundle — the headline Basis finding (from the v1 3-day sample). Refresh planned mid-May after ≥30 days of EC2 collection (Phase 8).

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
| 7 | Deploy | 🟡 In progress — EC2 infra shipped 2026-04-27; public deploy pending UI polish |

## Ongoing / post-Phase-6

1. **Keep cron running.** Residual estimates stabilize with ≥30 days. The writeup at [findings.md](findings.md) acknowledges the 3-day sample; numbers will be refreshed as data accumulates.
2. **Watch `skipped_unknown_gpu`** in `run_normalize.py` output — a new GPU name from any provider will require adding to `canonicalize.py`.
3. **Phase 7 (deploy)** is in progress. EC2 infrastructure shipped 2026-04-27 (see [basis-deployment-roadmap.md](basis-deployment-roadmap.md)). Public deploy (Caddy + Vercel + DNS for `gpu-basis.xyz`) is pending UI polish (1–2 weeks).

## Update log

- 2026-04-27 — Phases 0–6 of [basis-deployment-roadmap.md](basis-deployment-roadmap.md) shipped. Production runs on EC2 t3.small in `us-east-1` (EIP `52.70.173.217`) with systemd-driven twice-daily collection (`08:00` + `20:00` UTC), daily `pg_dump` backup to S3 (`basis-backups-rajt-2026`, 90-day lifecycle, versioned), and an hourly freshness probe. Three healthchecks.io endpoints monitor the alert path. IAM role `basis-ec2-role` provides Spot-pricing read + S3 backup write, so no AWS keys live in the EC2 `.env`. Mac collection cron stopped; 33,525 pre-EC2 obs frozen as a snapshot. UI polish via SSH tunnel begins now; public deploy waits on polish ready.
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
