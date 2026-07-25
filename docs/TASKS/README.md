---
title: Tasks & Status
tags: [area:planning, audience:all, status:active]
owner: Raj
last_updated: 2026-07-24
---

# Tasks & Status

Granular snapshot of current work for Basis. Last refreshed: **2026-07-24**.

Complements [roadmap.md](../roadmap.md) (high-level phases) and [project-brief.md](../project-brief.md) (what the project is). This file is the most-updated doc — treat it like a living to-do list.

## Project context

Basis is a public-data study measuring GPU compute fungibility across cloud providers — a portfolio piece aimed at demonstrating the kind of analysis Ornn AI's team does. See [project-brief.md](../project-brief.md) for the full overview.

---

## Done

### Phase 0 — Scaffold
- Repo structure: `backend/`, `frontend/`, `docs/`, `Basis_Project_Proposal.md`
- `pyproject.toml` + uv dependency management
- `docker-compose.yml` with Postgres
- Alembic migrations; initial schema (4 tables)
- Pydantic schemas (`schemas/raw.py`, `schemas/canonical.py`, `schemas/api.py`)
- SQLAlchemy ORM models (`db/models.py`)
- FastAPI app skeleton with stub routes
- Next.js 15 frontend skeleton (placeholder pages: Dispersion, Basis Decomposition, Providers, Methodology)
- `AGENTS.md`, `ARCHITECTURE.md`, `README.md`

### Phase 1 — Data Collection
- `BaseCollector` abstract contract with logging, persistence, dry-run
- `collectors/persist.py` — `save_observations()` bulk insert
- **Vast.ai** collector (REST) — `dph_total` → per-GPU pricing, `geolocation` parsing
- **RunPod** collector (GraphQL) — multi-tier pricing (on-demand, spot, reserved_*)
- **AWS EC2 Spot** collector (boto3, async via thread executor) — 7 regions, `p5/p5e/p4d/p4de/g5/g6` families, per-instance → per-GPU price conversion
- **TensorDock** collector (REST) — multi-location marketplace pricing
- **Lambda Labs** collector written but **dropped** (ADR 0003 — required payment method)
- `run_collect.py` CLI with `--dry-run`, specific-source selection
- `backend/collect_cron.sh` + crontab at 08:00 and 20:00
- `backend/logs/collect.log` rotation (manual)
- `.env` loading fixed to resolve from repo root regardless of CWD

### Phase 2 — Normalization
- `canonicalize.py` — 180+ GPU name → canonical SKU mappings covering H100/H200/B200/A100/A40/L40/L4/RTX 4xxx–5xxx/RTX Pro/RTX Ada/Quadro/Titan/Tesla/GTX/MI300X
- `commitment.py` — on_demand / spot / reserved_{1w,1m,3m,6m,1y,3y}
- `region.py` — per-source region parsing (AWS AZ stripping, Vast `"City, CC"`, TensorDock three-part strings)
- `bundle.py` — Vast cpu_cores_effective/cpu_ram_mb/disk_space_gb/verification extraction, TensorDock resources block
- `pipeline.py` — batched orchestrator with `skipped_unknown_gpu` tracking
- `run_normalize.py` CLI with `--reset`
- 9,979 canonical offers created from 9,979 raw observations — **0 skips**
- First H100 SXM cross-provider snapshot: $0.45 → $6.88 range

### Phase 3 — Analytics
- `analytics/dispersion.py` — per (date, gpu_sku) and per (date, gpu_sku, provider) median / p25 / p75; min 3 obs per bucket
- `analytics/basis.py` — sequential ANOVA on log-prices, fixed order region → commitment → provider → bundle → residual; NULL factors preserved as "UNKNOWN"; bundle composite = z-normalized (vCPUs + RAM + storage) quartiles; min 5 obs per (date, gpu_sku)
- `analytics/aggregates.py` — orchestrator, idempotent upsert into `daily_aggregates` and `basis_decomposition`
- `run_analytics.py` CLI with `--reset`, `--date`, `--gpu-sku`
- `backend/collect_cron.sh` now chains collect → normalize → analytics
- First outputs: **465 daily aggregate rows**, **179 decomposition rows** across 3 days and 97 SKUs
- Integrity check passes on every row (components + residual = total)
- **Headline finding: H100 SXM residual variance 53%–95%** across 3 observation days — the thesis confirmation

### Phase 4 — API Endpoints

> The 6 endpoints below were the Phase 4 surface; v2 Phases A/B later grew the API to **11 endpoints across 8 route modules** (added `fungibility-matrix` plus 3 provenance endpoints and the `basis/{sku}/timeseries` route).

- `GET /health` — simple readiness check
- `GET /api/offers` — filter by gpu_sku / provider / commitment_type / region_country / since / until; page + page_size pagination; total count returned
- `GET /api/dispersion/{gpu_sku}` — time series from `daily_aggregates`, optional since/until and per-provider filter; IQR computed on the fly
- `GET /api/basis/{gpu_sku}` — latest decomposition by default, or `?date=YYYY-MM-DD`; computes `pct_explained` and `pct_residual`; 404 on missing
- `GET /api/providers` — 4 providers with offer counts, distinct SKU coverage, latest collection timestamp, median deviation vs. market median
- `GET /api/gpu-skus` — 97 canonical SKUs with offer counts, provider counts, latest median price
- New Pydantic response models: `ProviderSummary`, `ProviderListResponse`, `GpuSkuSummary`, `GpuSkuListResponse`
- All endpoints registered in `basis/api/main.py`; CORS already configured for `localhost:3000`
- Smoke-tested via curl: filters work, pagination works, 404s return sensible details

### Phase 5 — Frontend
- `frontend/lib/types.ts` + `frontend/lib/api.ts` — typed client for all 5 data endpoints + `/health`
- `components/providers.tsx` — React Query wrapper (60s staleTime, retry=1, no refetch on focus)
- `components/SkuPicker.tsx` — dropdown sorted by offer count
- `components/DispersionChart.tsx` — Tremor `LineChart`, p25/median/p75, formatted `$/hr` y-axis
- `components/BasisDecompositionChart.tsx` — Tremor `DonutChart` + side panel leading with residual %; attribution table
- `components/ProviderComparisonChart.tsx` — Tremor `BarChart` for deviation + coverage table
- `app/basis/page.tsx`, `app/providers/page.tsx` — wired to real data with SKU picker
- `app/methodology/page.tsx` — fully written (data collection / canonical schema / dispersion / decomposition / limitations / what residual means)
- `app/layout.tsx` wraps children in `AppProviders`
- **Downgraded React 19 → 18** in package.json (Tremor peer dep). Next.js 15 supports both.
- `npm run build` passes cleanly; `npm run dev` + backend round-trip verified (all pages + 5 proxied API routes return 200)

### Phase 6 — Writeup & Polish
- `docs/findings.md` — ~1200-word analytical piece with frontmatter: hook / what Basis is / method / numbers / why residual is large / implications / limitations / what's next
- `frontend/app/page.tsx` rewritten as **Findings landing** (hero claim, 3-day decomposition table, 4-card navigation, caveats section) — replaces the old dispersion chart at `/`
- `frontend/app/dispersion/page.tsx` created — the previous home page moved here
- `frontend/app/layout.tsx` nav updated: `Findings / Dispersion / Basis Decomposition / Providers / Methodology`
- Root `README.md` rewritten — leads with the residual finding, keeps structure + quickstart, points at docs
- Build rerun after restructure: 5 routes compile cleanly

### Documentation (2026-04-20)
- `CLAUDE.md` with workflow + doc-maintenance rules
- `docs/INDEX.md` central hub
- `docs/00-start-here/{quickstart,dev-commands}.md`
- `docs/01-architecture/{system-overview,data-flow}.md` + ADRs 0001, 0002 (conservative normalization), 0003 (skip Lambda Labs)
- `docs/02-reference/{data-sources,database,api,config-and-env,observability}.md`
- `docs/03-guides/{add-collector,add-normalization-rule,run-collection,troubleshooting}.md`
- `docs/05-llm/DOC_MAP.md` + context packs for collectors / normalization / analytics
- `docs/project-status.md`, now joined by `project-brief.md`, `roadmap.md`, `TASKS/README.md`, `decisions/adr-log.md`, `reference/domain-model.md`, `guides/operations-runbook.md`

### Deployment — basis-deployment-roadmap.md Phases 0–6 (shipped 2026-04-27)

Production now lives on EC2; Mac collection cron is stopped and 33,525 pre-EC2 obs are frozen as a baseline snapshot. Detailed playbook: [basis-deployment-roadmap.md](../basis-deployment-roadmap.md). Operational state in [project-status.md](../project-status.md#production-state).

- AWS EC2 t3.small, Ubuntu 24.04, in `us-east-1`. Elastic IP `52.70.173.217`. 2 GiB swap file at `/swapfile`, persisted via `/etc/fstab`.
- IAM role `basis-ec2-role` attached, with two inline policies: `basis-spot-read` (`ec2:DescribeSpotPriceHistory`) and `basis-s3-backup` (`s3:PutObject` / `GetObject` / `DeleteObject` on `arn:aws:s3:::basis-backups-rajt-2026/*` plus `s3:ListBucket` on the bucket). Collectors and the backup script use the default credential chain — no AWS keys in the EC2 `.env`.
- S3 bucket `basis-backups-rajt-2026` (`us-east-1`) — versioning on, 90-day lifecycle (current expiry + permanent noncurrent delete), Block Public Access on, SSE-S3.
- systemd unit set under `backend/deploy/systemd/` (7 unit files + README):
  - `basis-postgres.service` — oneshot at boot; brings Docker compose Postgres up healthcheck-gated.
  - `basis-collect.service` + `basis-collect.timer` — twice daily at `08:00 + 20:00` UTC, `RandomizedDelaySec=300`, `Persistent=true`.
  - `basis-backup.service` + `basis-backup.timer` — daily `pg_dump` at `03:00` UTC to S3, `RandomizedDelaySec=600`, `Persistent=true`.
  - `basis-data-fresh.service` + `basis-data-fresh.timer` — top of hour, `RandomizedDelaySec=120`, `Persistent=true`.
- Three healthchecks.io endpoints on the alert path: `basis-collect` (cron `0 8,20 * * *`, 30 min grace), `basis-backup` (cron `0 3 * * *`, 1 hr grace), `basis-data-fresh` (period 1 hr, 14 hr grace — a single missed collection alerts ~14 h later).
- Production `.env` at `/home/ubuntu/Basis/.env`, mode `600` — `DATABASE_URL`, `POSTGRES_PASSWORD`, `ENVIRONMENT=prod`, `AWS_DEFAULT_REGION`, `CORS_ORIGINS`, three `HC_*_PING_URL` values, no AWS keys.
- Docker compose Postgres bound to `127.0.0.1:5433`, healthcheck-gated.
- `backend/scripts/{backup.sh,data_fresh_check.sh}` shipped as part of Phase 4 PR.
- `fix/vast-retry-and-partial-success` (Phase 4.5 PR) — vast.ai collector now retries on 429 / 5xx / transient errors with exponential backoff (1 s, 2 s, 4 s) and preserves partial success when one of two endpoints fails after retries. All 4 collectors hit on every run.
- `fix/alembic-env-reads-settings` (merged) — Alembic `env.py` now reads `settings.database_url` instead of the `alembic.ini` default, fixing migrations on EC2.
- `d164642` (direct to main) — `backend/scripts/backup.sh` cleanup `find` scoped to `/tmp` top level with `-maxdepth 1 ... 2>/dev/null || true`, so unrelated permission denials in `/tmp` subdirs don't fail the backup unit.
- DNS for `gpu-basis.xyz` / `api.gpu-basis.xyz` live (Vercel + Caddy); Phase 7.4 `basis-api.service` not shipped — see **Operational debt** below.

### Operational fixes (2026-07-12 — 2026-07-13)

- **Vast API key auth shipped (#10, 2026-07-12).** Collector sends `Authorization: Bearer` when `VAST_API_KEY` is set, bypassing Vast's 64-offer keyless cap (root cause of the June H100-SXM outage). Regression tests + `scripts/probe_vast_api.py`.
- **Per-provider volume alert shipped (#13, 2026-07-12).** `scripts/check_collection_volume.py` runs at end of `collect_cron.sh`; compares latest run per provider to 21-day rolling median; pings `HC_VOLUME_PING_URL` / `HC_VOLUME_PING_URL/fail`.
- **Normalization anti-join fix (#12, 2026-07-12).** `NOT EXISTS` anti-join + index on `raw_observation_id` — idempotent re-normalization without duplicates.
- **TensorDock parked (#14, 2026-07-13).** Public feed empty; removed from `EXPECTED_PROVIDERS` in volume check. Collector left in place (returns 0). **3 active collectors:** Vast, RunPod, AWS Spot.

### Phase 7+ — Post-deploy analysis

- **Findings refresh shipped (2026-05-15).** First 18 days of EC2 collection (2026-04-26 → 2026-05-13) decomposed and written up. Segment-conditional headline (~59% / ~89%) replaces the v1 3-day 53–95% range. Vast.ai dominance promoted from implicit to explicit caveat in [findings.md](../findings.md) and [methodology.md](../methodology.md). Cross-SKU numbers refreshed (A100 SXM 80GB 24%, RTX 4090 24GB 86%). New backend param `exclude_providers` on `GET /api/basis/{sku}/timeseries` recomputes on demand against `canonical_offers`; new frontend hero renders both numbers side-by-side. Investigation report committed at [`docs/analysis/2026-05-13-findings-refresh-analysis.md`](../analysis/2026-05-13-findings-refresh-analysis.md). Branch: `feat/segment-conditional-finding`.

---

## In progress

UI polish: local Next.js (`npm run dev`) + SSH tunnel to EC2 FastAPI against production data. Procedure: [guides/dev-setup.md](../guides/dev-setup.md#run-against-production-data-polish-loop).

> **v2 redesign status (2026-06-23):** the residual-first redesign (ADR 0005) has **effectively landed on `main`** — Tremor removed, Fraunces/Inter/JetBrains fonts, hand-rolled SVG charts, redesigned methodology page. The standalone `ui-port-v2` branch is **stale/superseded** (`git diff main origin/ui-port-v2` shows main is ahead — the branch lacks `FactorStripPlot`, `ResidualTimeSeriesChart`, the methodology components, and ~1226 lines of `globals.css`). The v2 work went straight to main via PR #8, not by merging the branch. **Action:** delete `origin/ui-port-v2` once confirmed nothing unique remains.

---

## Pending / next up

### Frontend / UI

- [ ] **Mobile-responsive layout.** The dashboard is chart- and plot-heavy (hand-rolled SVG: `FactorStripPlot`, `ResidualTimeSeriesChart`, `DecompBar`, fungibility matrix, provenance drawer). Audit and adapt all pages for phone-sized viewports — readable typography, touch-friendly controls, charts that reflow or scroll without clipping, and navigation that works on narrow screens. Goal: a seamless small-screen experience, not just "doesn't break." See ADR 0005 (SVG over Tremor) and [`temp-doc/basis-frontend-reference.md`](../../temp-doc/basis-frontend-reference.md) for component inventory.

### Operational (post-deployment)

- [ ] **Phase 8 — reboot test on EC2** (overdue — now actionable). Hard reboot, verify `basis-postgres.service` brings Postgres up healthcheck-gated and all timers come back active. `Type=oneshot` units showing `Active: inactive (dead)` after success is the pass signal.
- [ ] **Phase 8 — weekly operational checks** (ongoing). Timer health, journal scan for `code=exited, status=0/SUCCESS`, S3 backup integrity, healthchecks.io dashboard green, disk + swap usage.
- [ ] **v2 Phase D — Rolling stability view** (now unblocked, not built). Was blocked on ≥30 days of cron data; that threshold passed ~2026-05-17 and the window is now ~58 days. This is the main remaining v2 feature. (Phase C — slice interactivity — was intentionally **skipped**, see [`temp-doc/phase-c-scoping.md`](../../temp-doc/phase-c-scoping.md); not a gap.)
- [ ] **Add curated providers** to reduce Vast.ai's ~75% share — revisit Lambda Labs under different terms, add CoreWeave, add Crusoe. Each new collector would sharpen the segment-dependence picture in [findings.md](../findings.md) without changing methodology.
- [ ] **Tailscale (or AWS SSM Session Manager) setup** — only if home-IP rotation continues to break the security-group whitelist often. Workarounds, in order of friction: widen to `/24` → widen to `/16` → Tailscale → SSM.

### Operational debt

- [ ] **Phase 7.4 — `basis-api.service` (not shipped).** FastAPI is still started with **`nohup`** during polish sessions instead of systemd. Until this lands, every **`git pull` on EC2 requires a manual uvicorn restart** or the live process serves stale code — the main failure mode behind “API looks fine but behaves wrong.” Shipping 7.4 replaces the nohup workflow with `sudo systemctl restart basis-api` (see [basis-deployment-roadmap.md](../basis-deployment-roadmap.md) Phase 7.4). Developer runbook: [guides/dev-setup.md](../guides/dev-setup.md#restart-uvicorn-after-every-git-pull-on-ec2-critical).

### Phase 7 — Public deploy (shipped except 7.4)

[Phases 7.1–7.3, 7.5, and 7.6](../basis-deployment-roadmap.md) are live: DNS, Caddy (`https://api.gpu-basis.xyz`), Vercel (`https://gpu-basis.xyz`). **Phase 7.4** (`basis-api.service`) was planned but never enabled — tracked under **Operational debt** above.

### Phase 9 — Shutdown procedure (eventual)

Tear-down checklist when the project is wound down (~3 months out). See [basis-deployment-roadmap.md](../basis-deployment-roadmap.md) Phase 9.

### Ongoing (post-Phase-6)

- [x] **Re-anchor the writeup to the 60-day window** — done 2026-06-24.
- [x] **Re-anchor to the 77-day window** — done 2026-07-11. H100 ~60% / ~82%; report [analysis/2026-07-11-findings-refresh.md](../analysis/2026-07-11-findings-refresh.md).
- [x] **Fix Vast collection collapse** — collector auth shipped 2026-07-12 (#10). Ensure `VAST_API_KEY` on EC2.
- [x] **Per-provider volume alert** — shipped 2026-07-12 (#13).
- [ ] **Next findings refresh** — when window grows materially past 77 days (TBD).
- [ ] **Monitor for `skipped_unknown_gpu`**
- [ ] **Optional: screenshot reel / portfolio post.** Manual step (Raj's call) — not code.

### Cross-cutting / nice-to-haves

- [ ] Backfill strategy for missed cron runs (e.g., detect gaps and log a warning)
- [ ] Extend AWS Spot window to 7+ days for historical baseline (currently 24h per run)
- [ ] Handle new `skipped_unknown_gpu` cases as they appear — watch `run_normalize.py` output
- [ ] Consider Type III (marginal) variance attribution in addition to sequential — would let us report both "region-first" and "provider-first" residuals
- [ ] Periodically prune `backend/logs/collect.log`

---

## Blockers

No active blockers. Watch items:

- **Provider API shape changes.** TensorDock's `gpus` field changed shape once during the build. TensorDock is now parked (empty public feed). Watch parse-error logs on active collectors.

(The former Mac-laptop-cron blockers — laptop-sleep cron misses and Docker-must-be-running-at-cron-times — are obsolete: production moved to EC2 systemd timers on 2026-04-27 and the Mac cron is stopped.)

---

## Known code-level discrepancies (from 2026-06-23 audit)

Mismatches between code and stated intent. Flagged, not yet resolved. Full write-up: [`temp-doc/2026-06-23-doc-freshness-and-discrepancy-audit.md`](../../temp-doc/2026-06-23-doc-freshness-and-discrepancy-audit.md).

- [ ] **`collectors/__init__.py` still lists `LambdaLabsCollector`** in `COLLECTORS`/`__all__`, contradicting ADR 0003 and `run_collect.py`'s `AVAILABLE` dict (which excludes it). Harmless today but a latent footgun — remove from the list or annotate it as decorative.
- [ ] **`backend/basis/scheduler/jobs.py` is an unimplemented stub** whose docstring still references "Lambda, TensorDock pricing page scrapes" — a plan superseded twice (cron/systemd drives scheduling; Lambda dropped; no scraping). Delete the module or replace the docstring with a "parked" note.
- [ ] **Test suite is red:** `test_api.py::test_basis_timeseries` fails on a data-window assumption (picks an SKU whose decomposition predates the 30-day timeseries lookback). Fix the SKU selection to require a decomposition within the window, or skip when none qualifies. Not a product bug.

## Deprecated / parked

- **Lambda Labs collector** (`backend/basis/collectors/lambda_labs.py`) — code retained but not registered in `run_collect.py`. See ADR-003.
- **TensorDock collector** — **parked 2026-07-13.** Public feed returns empty inventory; still in `run_collect.py` `AVAILABLE` but returns 0 offers. Excluded from volume alert. See [data-sources.md](../02-reference/data-sources.md#tensordock).
- **Scheduler module** (`backend/basis/scheduler/`) — APScheduler was scaffolded but not used; `jobs.py` is a TODO stub. Cron / EC2 systemd timers drive collection instead.
- **Playwright / BeautifulSoup scraping** — original plan for Lambda Labs + TensorDock. Not needed once API endpoints were found.

---

## Related

- [Roadmap](../roadmap.md)
- [Project Brief](../project-brief.md)
- [System Overview](../01-architecture/system-overview.md)
- [DOC_MAP](../05-llm/DOC_MAP.md)

---

## Update log

Append a one-liner each time this file is updated.

- 2026-07-24 — **Doc reconciliation.** Operational fixes documented: Vast auth (#10), volume alert (#13), TensorDock parked (#14). 3 active collectors. Ongoing/pending updated; 77-day findings refresh marked done; next refresh TBD.
- 2026-06-24 — Added **mobile-responsive layout** to Pending (Frontend / UI): chart-heavy pages need phone-sized audit and polish.
- 2026-06-24 — **Findings re-anchored to the 60-day window** (2026-04-26 → 2026-06-24) against live EC2 data. H100 SXM 80GB 59%/89% → ~60%/~82% (medians 60.5/81.9; +21.4 pp shift). Corpus 90k → 295,047 offers / 96 SKUs. New report [analysis/2026-06-24-findings-refresh.md](../analysis/2026-06-24-findings-refresh.md); findings.md, methodology.md, project-status.md, README lede updated. Flagged Vast H100-SXM dropouts on 4 recent runs (6/16, 6/17, 6/23, 6/24) as a collection-reliability watch item.
- 2026-06-23 — Full repo doc-freshness & discrepancy audit (29 files reconciled with `main`). Six stale themes fixed across the docs (v2 UI landed on main; 11 endpoints not 6; analytics shipped; prod live on EC2+Vercel; EC2 systemd not laptop cron; time-expired claims). Added: v2 **Phase D** (rolling stability, unblocked/not built) to Pending; **Known code-level discrepancies** section (Lambda still in `COLLECTORS`, scheduler stub, red `test_basis_timeseries`); `ui-port-v2` flagged stale/superseded (main is ahead). Noted v2 Phases A/B grew the API to **11 endpoints across 8 modules**. Phase 8 reboot test + ≥60-day re-anchor now **overdue/actionable** (window ≈ 58 days). Full write-up: [`temp-doc/2026-06-23-doc-freshness-and-discrepancy-audit.md`](../../temp-doc/2026-06-23-doc-freshness-and-discrepancy-audit.md). Companion edits in [project-status.md](../project-status.md), [roadmap.md](../roadmap.md), [project-brief.md](../project-brief.md), [INDEX.md](../INDEX.md).
- 2026-05-16 — Polish-loop developer docs landed on `docs/polish-loop-cleanup`. README Quickstart now leads with the three-terminal polish-loop workflow; `docs/00-start-here/dev-commands.md` and `docs/guides/dev-setup.md` document the SSH-tunnel + `nohup` uvicorn procedure and the mandatory post-`git pull` restart. Phase 7 status and Operational debt sections (Phase 7.4 `basis-api.service` unshipped) added to this file and to [project-status.md](../project-status.md).
- 2026-05-15 — Findings refresh shipped on `feat/segment-conditional-finding`. Segment-conditional framing (~59% / ~89%) replaces the v1 single-residual headline. Vast.ai dominance (80% of canonical offers) promoted from implicit to explicit caveat. Cross-SKU comparison numbers refreshed against the 18-day EC2 window. Backend: new `exclude_providers` param on `/api/basis/{sku}/timeseries`. Frontend: dual-number hero with count-up motion. Docs: [findings.md](../findings.md), [methodology.md](../methodology.md), [project-status.md](../project-status.md), and the lede in root [README.md](../../README.md) all reflect the refresh. Source: [`docs/analysis/2026-05-13-findings-refresh-analysis.md`](../analysis/2026-05-13-findings-refresh-analysis.md).
- 2026-05-12 — Phase 7 public URLs live (`gpu-basis.xyz`, `api.gpu-basis.xyz`). Phase 7.4 `basis-api.service` remains unshipped; FastAPI under manual `nohup`; polish-loop runbook drafted under [guides/dev-setup.md](../guides/dev-setup.md).
- 2026-04-27 — Phases 0–6 of [basis-deployment-roadmap.md](../basis-deployment-roadmap.md) shipped. Production is live on EC2 t3.small with twice-daily collection, daily backup, hourly freshness probe. UI polish via SSH tunnel begins now.
- 2026-04-21 — UI port begun on `ui-port-v2` branch. Baseline on main (`7776ae5`) captures pre-port state + all tests passing. Stage 1 of 7 shipped on the branch: CSS design tokens + utility classes, next/font Fraunces/Inter/JetBrains Mono, redesigned shell (sticky TopBar, serif wordmark, flat nav, footer), Tailwind config (Tremor + typography plugin dropped), `useSku` hook, `factorColor` + `gpuFamily` utilities. Pages still render v1 content — expected; gets resolved as Stage 5 ports each page. Port decision captured as ADR 0005 (Proposed). No merge to main until end-to-end port complete.
- 2026-04-21 — Pipeline offset/filter bug fixed: `run_normalization` now uses an id-based cursor instead of a numeric offset. Regression test `test_run_normalization_processes_all_rows_when_exceeding_batch_size` added to `test_normalization.py` (reproduced the bug at 5979/9979 before the fix; 9979/9979 after). Backfill verification: zero silent data loss in the current DB — last session's `batch_size=20000` workaround had fully regenerated the corpus. Stale smoke-tests placeholder removed from Cross-cutting (all four files shipped in the previous session).
- 2026-04-21 — Country-code normalization fixed: TensorDock's full country names (e.g., "United States") now map to ISO-2 codes (`US`), matching AWS and Vast. Lookup table covers 7 country names actually observed in data. Canonical offers + analytics regenerated; residual shifts all < 0.005pp across 179 decomposition rows (TensorDock's small share in any single SKU meant the fix made storage consistent without perturbing findings). Full suite (19 tests) passes.
- 2026-04-21 — Test suite backfill: test_normalization.py (AST guard + fidelity test sampling 50 random offers), test_analytics.py (decomposition identity + threshold invariants), test_collectors.py (parse tests, fixture-gated with capture script at `backend/tests/fixtures/capture_fixtures.py`), test_api.py (10 endpoint smoke tests). DB-availability guard in conftest.py skips cleanly when DB is down.
- 2026-04-21 — Basis v2 Phase C skipped. Phases A + B + D cover the narrative arc; interactive slicing adds cost without load-bearing value. Rationale in `temp-doc/phase-c-scoping.md`. ADR 0005 not pursued.
- 2026-04-21 — Basis v2 Phase B shipped: three provenance endpoints (`/api/decomposition/{sku}/observations`, `/api/raw-observation/{id}`, `/api/raw-observation/{id}/explain`), parallel `explain_*` functions across all four normalization modules, AST guard test enforcing ADR 0004, `ObservationsDrawer` + `RawObservationInspector` surfaced from `/basis`.
- 2026-04-21 — Basis v2 Phase A shipped: `/api/fungibility-matrix` endpoint, landing-page `FungibilityMatrix` hero, `BasisDecompositionChart` rebuilt residual-first. Proposal at `temp-doc/basis-v2-proposal-r2.md`.
- 2026-04-20 — Phase 6 complete; findings.md written, frontend restructured to lead with the finding, README rewritten. Basis v1 is feature-complete.
- 2026-04-20 — Phase 5 complete; dashboard live with 4 pages, 3 Tremor charts, typed API client; React downgraded to 18 for Tremor peer compatibility.
- 2026-04-20 — Phase 4 complete; 6 REST endpoints live against real data; caught a country-code normalization inconsistency (logged as cross-cutting).
- 2026-04-20 — Phase 3 complete; analytics ships its first real outputs (H100 SXM residual 53%–95%).
- 2026-04-20 — initial TASKS snapshot after completing Phases 0/1/2 and creating full doc structure.
