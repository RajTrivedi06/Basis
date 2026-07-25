---
title: Project Status (TL;DR)
tags: [area:planning, audience:all, status:active]
owner: Raj
last_updated: 2026-07-24
---

# Project Status (TL;DR)

Quick snapshot. For detailed status, see [TASKS/README.md](TASKS/README.md). For the phase plan, see [roadmap.md](roadmap.md). For what Basis is, see [project-brief.md](project-brief.md).

## Current phase

**Basis v1 complete.** Phases 0–6 shipped. Phase 7 public surfaces are live: **https://gpu-basis.xyz** (Vercel) and **https://api.gpu-basis.xyz** (EC2, Caddy). Roadmap **Phase 7.4** (`basis-api.service`) did **not** ship — FastAPI is still run manually under `nohup` for polish sessions and must be restarted after every `git pull` on EC2 (see [guides/dev-setup.md](guides/dev-setup.md#restart-uvicorn-after-every-git-pull-on-ec2-critical)). EC2 infrastructure and Phases 0–6 of [basis-deployment-roadmap.md](basis-deployment-roadmap.md) shipped 2026-04-27.

**Basis v2 in progress.** Phase A shipped on 2026-04-21. Proposal: [temp-doc/basis-v2-proposal-r2.md](../temp-doc/basis-v2-proposal-r2.md).

**UI v2 residual-first redesign has effectively landed on `main`.** Tremor is gone from `frontend/package.json`; `layout.tsx` loads Fraunces/Inter/JetBrains Mono; `globals.css` is ~1700 lines of v2 tokens; hand-rolled SVG charts (`FactorStripPlot`, `ResidualTimeSeriesChart`, `components/charts/DecompBar`) and the redesigned methodology page are all on main. Decision: [ADR 0005](01-architecture/adr/0005-residual-first-ui.md). The standalone `ui-port-v2` branch was never formally git-merged, but main already carries the v2 styling, tokens, fonts, and chart components — main is no longer v1.

## Production state

EC2 deployment shipped 2026-04-27. Phases 0–6 of [basis-deployment-roadmap.md](basis-deployment-roadmap.md) are complete. **Phase 7** — DNS, Caddy, and Vercel are live (`gpu-basis.xyz`, `api.gpu-basis.xyz`). **Phase 7.4** (FastAPI as `basis-api.service`) was planned in the roadmap but **not implemented**; the API process is started with **`nohup`** during polish work (see [Known operational debt](#known-operational-debt)). Phase 8 covers the post-deploy reboot test, weekly checks, and a mid-May findings refresh; Phase 9 is the eventual shutdown procedure.

- **Compute.** AWS EC2 t3.small, Ubuntu 24.04, Elastic IP `52.70.173.217`, region `us-east-1`. 2 GiB swap file at `/swapfile`, persisted via `/etc/fstab`.
- **IAM.** Role `basis-ec2-role` with two inline policies: `basis-spot-read` (`ec2:DescribeSpotPriceHistory`) and `basis-s3-backup` (`s3:PutObject` / `GetObject` / `DeleteObject` on `arn:aws:s3:::basis-backups-rajt-2026/*`, plus `s3:ListBucket` on the bucket). Collectors and backup script use the default credential chain — no AWS keys in the EC2 `.env`.
- **Backups.** S3 bucket `basis-backups-rajt-2026` in `us-east-1` — versioning on, 90-day lifecycle (current expiry + permanent noncurrent delete), Block Public Access on, SSE-S3.
- **Automation (systemd).** `basis-postgres.service` (oneshot at boot) brings Docker compose Postgres up. Three timers run the work: `basis-collect.timer` (`08:00` + `20:00` UTC), `basis-backup.timer` (`03:00` UTC), `basis-data-fresh.timer` (top of hour). All timers `Persistent=true` with `RandomizedDelaySec`.
- **Monitoring.** Four healthchecks.io endpoints on the alert path: `basis-collect` (cron `0 8,20 * * *`, 30 min grace), `basis-backup` (cron `0 3 * * *`, 1 hr grace), `basis-data-fresh` (period 1 hr, 14 hr grace — a single missed collection alerts ~14 h later), and `basis-collect-volume` (fires after each collection run via `check_collection_volume.py` — pages on a per-provider volume collapse). The volume check compares each active provider's latest run to a 21-day rolling median; TensorDock is excluded (parked).
- **Database.** Docker compose Postgres bound to `127.0.0.1:5433`, healthcheck-gated.
- **Production env.** `/home/ubuntu/Basis/.env`, mode `600`. Holds `DATABASE_URL`, `POSTGRES_PASSWORD`, `ENVIRONMENT=prod`, `AWS_DEFAULT_REGION`, `CORS_ORIGINS`, `VAST_API_KEY` (required since 2026-06-23 — Vast caps unauthenticated requests at 64 offers), and four `HC_*_PING_URL` values (`HC_PING_URL`, `HC_BACKUP_PING_URL`, `HC_DATA_FRESH_PING_URL`, `HC_VOLUME_PING_URL`).
- **Domains.** `gpu-basis.xyz` (Vercel frontend) and `api.gpu-basis.xyz` (EC2 API behind Caddy) are live; registrar remains Namecheap.

### Known operational debt

- **Phase 7.4 — `basis-api.service` not shipped.** FastAPI runs under **`nohup`** instead of systemd. A `git pull` on EC2 does not reload Python code in the running process — contributors must **restart uvicorn after every pull** or the live API drifts from disk (a recurring outage mode). When 7.4 ships, prefer `sudo systemctl restart basis-api` (see [basis-deployment-roadmap.md](basis-deployment-roadmap.md) Phase 7.4).

For deploy-day procedure, see [basis-deployment-roadmap.md](basis-deployment-roadmap.md). Day-to-day developer workflow (polish loop, tunnels, restarts): [guides/dev-setup.md](guides/dev-setup.md). Day-to-day operations live in [guides/operations-runbook.md](guides/operations-runbook.md).

## v2 progress

| Phase | Scope | Status |
|-------|-------|--------|
| A | Residual-first landing + fungibility matrix | ✅ Shipped 2026-04-21 |
| B | Provenance drilldown (parallel `explain_*` functions) | ✅ Shipped 2026-04-21 |
| C | Slice interactivity | ⬛ Skipped 2026-04-21 — see [`temp-doc/phase-c-scoping.md`](../temp-doc/phase-c-scoping.md) |
| D | Rolling stability view | 🔲 Data threshold reached as of ~2026-05-17; ready to start (pending execution) |
| UI port | Residual-first redesign (ADR 0005) | 🟢 Effectively landed on `main` (Tremor removed, v2 fonts/tokens/hand-rolled SVG charts live); the standalone `ui-port-v2` branch remains unmerged |

## Data at a glance (2026-07-11, 77-day window)

> Refreshed 2026-07-11 against live EC2 data (window 2026-04-26 → 2026-07-11). The dashboard updates continuously, so live medians may differ by a few tenths of a pp.

- **3 active collectors:** Vast.ai, RunPod, AWS Spot. (Lambda Labs dropped — ADR 0003; **TensorDock parked 2026-07-13, deregistered from `run_collect.py` 2026-07-24** — public feed drained, inventory moved behind an API key; see [data-sources.md](02-reference/data-sources.md#tensordock).)
- **Raw observations on EC2:** 318,372 across the 4 providers since the 2026-04-26 cutover (77 days). A separate 33,525-row Mac snapshot was frozen at cutover as pre-EC2 history; new collection only writes to EC2.
- **Canonical offers:** 315,743 (1:1 normalization, minimal skips). Provider mix: Vast.ai 237,746 (75.3%) · AWS Spot 45,448 (14.4%) · RunPod 30,065 (9.5%) · TensorDock 2,484 (0.8%).
- **Canonical SKUs:** 96.
- **Schedule:** systemd timers on EC2 — collect at `08:00 + 20:00` UTC, backup at `03:00` UTC, hourly freshness probe. The Mac cron (`backend/collect_cron.sh`) is stopped.
- **H100 SXM 80GB residual variance:** **~60% (Vast included) / ~82% (Vast excluded)** of log-price variance is unexplained over the 77-day window (medians 60.3% / 81.9%, a +21.6 pp segment-conditional shift — essentially unchanged from the 60-day refresh). See [findings.md](findings.md) and the [2026-07-11 refresh report](analysis/2026-07-11-findings-refresh.md).
- **Data-quality — Vast collection collapse (historical, affects 77-day window):** Vast returned **zero H100-SXM offers for 21 days** within the window (isolated misses 2026-06-16/06-17, then sustained 2026-06-23 → 07-11). All ten of the window's top residual days sit inside it — ~90% single-day readings there are collection artifacts, not market signals. **Root-caused 2026-07-11:** Vast hard-caps unauthenticated requests at 64 cheapest-first offers (`limit` ignored), collapsing total Vast collection ~97% (~6,400 → ~220 offers/day) on 06-23. **Fix shipped 2026-07-12:** collector sends `Authorization: Bearer` when `VAST_API_KEY` is set (`fix/vast-api-key-auth`, #10). A per-provider volume alert also shipped 2026-07-12 (`check_collection_volume.py`, #13). Post-fix collection resumes for new days; the 77-day analytical window still contains the outage tail. Diagnosis: [2026-07-11 refresh](analysis/2026-07-11-findings-refresh.md). (TensorDock **parked 2026-07-13** — public feed empty, ~0.8% of historical offers; see [data-sources.md](02-reference/data-sources.md#tensordock).)

## Phase status table

| # | Phase | Status |
|---|-------|--------|
| 0 | Scaffold | ✅ Complete |
| 1 | Data Collection | ✅ Complete (3 active of 5 evaluated — Lambda dropped, TensorDock parked) |
| 2 | Normalization | ✅ Complete |
| 3 | Analytics | ✅ Complete |
| 4 | API Endpoints | ✅ Complete (11 endpoints across 8 route modules; v2 Phases A/B grew this from the original 6) |
| 5 | Frontend Dashboard | ✅ Complete (5 pages, hand-rolled SVG charts) |
| 6 | Analytical Writeup & Polish | ✅ Complete |
| 7 | Deploy | 🟢 Public live (Vercel + Caddy + DNS); Phase 7.4 `basis-api.service` not shipped — manual `nohup` uvicorn |

## Ongoing / post-Phase-6

1. **Keep cron running.** Residual estimates continue to tighten as the window grows. [findings.md](findings.md) is anchored to the 77-day window (2026-04-26 → 2026-07-11); the dashboard refreshes live and may differ by a few tenths of a pp.
2. **Confirm `VAST_API_KEY` on EC2** and monitor volume alerts. The collector fix and `check_collection_volume.py` shipped 2026-07-12; ensure production `.env` has a valid key and `HC_VOLUME_PING_URL` is wired. Backfill normalize/analytics if any post-fix collection gaps remain.
3. **Watch `skipped_unknown_gpu`** in `run_normalize.py` output — a new GPU name from any provider will require adding to `canonicalize.py`. Logging the skipped `gpu_model_reported` would surface a genuine rename immediately instead of silently zeroing a SKU.
4. **Phase 7 (deploy)** — public frontend and API URLs are live. **Phase 7.4** (`basis-api.service`) remains open operational debt; see [guides/dev-setup.md](guides/dev-setup.md#known-operational-debt) and [basis-deployment-roadmap.md](basis-deployment-roadmap.md) Phase 7.4.
5. **Add curated providers** (Lambda Labs revisit, CoreWeave, Crusoe) to reduce Vast.ai's ~75% share of canonical offers and sharpen the segment-dependence picture.
6. **Refresh findings** when the window grows materially (next anchor TBD) — [findings.md](findings.md) numbers are frozen to the 77-day window through 2026-07-11.

## Update log

- 2026-07-24 — **Doc reconciliation** across the repo. Operational docs now reflect: Vast auth fix shipped (#10, 2026-07-12), per-provider volume alert (#13), TensorDock parked (#14, 2026-07-13), **3 active collectors**. `api.md` deploy status corrected (public live). `VAST_API_KEY` documented as effectively required. No new findings refresh — analytical numbers remain anchored to the 77-day window (2026-04-26 → 2026-07-11).
- 2026-07-11 — **Findings refresh to the 77-day window** (2026-04-26 → 2026-07-11), recomputed against live EC2 data. H100 SXM 80GB headline holds at **~60% / ~82%** (medians 60.3 / 81.9; +21.6 pp segment shift — essentially flat vs the 60-day refresh, confirming the finding is stable). Corpus 295k → **315,743 offers / 96 SKUs**; Vast share fell 79.3% → **75.3%**. Lead finding: a **21-day Vast H100-SXM outage** (isolated 6/16–6/17, then sustained 6/23 → 7/11) now owns the entire top-residual tail — a collection artifact, root-caused (via `raw_observations` audit + live API probe) to a **new Vast 64-offer cap on unauthenticated requests** — total Vast collection fell ~97% (~6,400 → ~220 offers/day on 6/23), the `limit` param is ignored, and cheapest-first paging structurally hides the expensive H100 tier. Fix is a free Vast API key. Also surfaced a **two-regime curated-only structure** inside the outage (~90% through 7/02, then ~52% from 7/03 as AWS regional dispersion widened). `decompose_without_vast.py` window made env-driven. [findings.md](findings.md), [methodology.md](methodology.md), and new report [analysis/2026-07-11-findings-refresh.md](analysis/2026-07-11-findings-refresh.md) updated; prior refreshes marked superseded.
- 2026-06-24 — **Findings refresh to the 60-day window** (2026-04-26 → 2026-06-24), recomputed against live EC2 data. H100 SXM 80GB headline moves **59% / 89% → ~60% / ~82%** (medians 60.5 / 81.9; +21.4 pp segment shift, narrower than the 18-day +29). Corpus 90k → **295,047 offers / 96 SKUs**. "Data at a glance" refreshed from the frozen snapshot to current numbers. Surfaced a data-quality watch item: **Vast H100-SXM offers absent on 4 recent runs** (6/16, 6/17, 6/23, 6/24). [findings.md](findings.md), [methodology.md](methodology.md), and new report [analysis/2026-06-24-findings-refresh.md](analysis/2026-06-24-findings-refresh.md) updated.
- 2026-06-23 — Doc-freshness reconciliation across planning docs. Corrected API surface to **11 endpoints across 8 route modules** (was "6 endpoints"). Reframed the UI v2 redesign as **effectively landed on `main`** (Tremor removed, v2 fonts/tokens/hand-rolled SVG charts live; `ui-port-v2` branch still unmerged) — no longer "Stage 1 / not merged / pages render v1." Relabeled the "Data at a glance" block as a **frozen 2026-05-13 snapshot** with a caveat that live cron volumes are larger. Phase D reworded from blocked to "data threshold reached ~2026-05-17; ready to start." Companion edits in [TASKS/README.md](TASKS/README.md), [roadmap.md](roadmap.md), [project-brief.md](project-brief.md), [INDEX.md](INDEX.md).
- 2026-05-16 — Polish-loop developer docs landed on `docs/polish-loop-cleanup`. README Quickstart now leads with the three-terminal SSH-tunnel + `nohup` uvicorn workflow; new [`docs/00-start-here/dev-commands.md`](00-start-here/dev-commands.md) and [`docs/guides/dev-setup.md`](guides/dev-setup.md) document the polish loop and the mandatory post-`git pull` uvicorn restart. This file and [TASKS/README.md](TASKS/README.md) updated to Phase-7-public-live wording with an Operational debt section (Phase 7.4 `basis-api.service` unshipped).
- 2026-05-15 — Findings refresh shipped on `feat/segment-conditional-finding`. Segment-conditional framing (~59% / ~89%) replaces the v1 single-residual headline. Vast.ai dominance (80% of canonical offers) promoted from implicit to explicit caveat in both [findings.md](findings.md) and [methodology.md](methodology.md). Cross-SKU numbers (A100 24%, RTX 4090 86%) refreshed against the 18-day window. New `exclude_providers` query param on `GET /api/basis/{sku}/timeseries` powers a dual-number hero on the landing page. Investigation report: [`analysis/2026-05-13-findings-refresh-analysis.md`](analysis/2026-05-13-findings-refresh-analysis.md).
- 2026-05-12 — Public URLs live (`https://gpu-basis.xyz`, `https://api.gpu-basis.xyz`). Phase 7.4 `basis-api.service` not shipped; FastAPI under manual `nohup`; polish-loop runbook + mandatory post-`git pull` uvicorn restart drafted under [guides/dev-setup.md](guides/dev-setup.md) and [../README.md](../README.md).
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
- 2026-04-20 — Phase 4 complete: 6 REST endpoints live (health, offers, dispersion, basis, providers, gpu-skus) returning real data from canonical/aggregate tables. (v2 Phases A/B later grew this to 11.)
- 2026-04-20 — Phase 3 complete: dispersion + decomposition shipped; cron chained; first findings computed.
- 2026-04-20 — converted to TL;DR; detailed status lives in TASKS/README.md.
- 2026-04-20 — initial status doc after Phase 2 completion.
