---
title: Tasks & Status
tags: [area:planning, audience:all, status:active]
owner: Raj
last_updated: 2026-04-28
---

# Tasks & Status

Granular snapshot of current work for Basis. Last refreshed: **2026-04-28**.

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
- Domain `gpu-basis.xyz` registered at Namecheap; DNS not yet pointed (Phase 7 work).

---

## In progress

UI polish via SSH tunnel against the EC2 backend. Open-ended; sets the trigger for Phase 7 (public deploy via Caddy + Vercel + DNS).

---

## Pending / next up

### Operational (post-deployment)

- [ ] **Phase 8 — reboot test on EC2** (this week). Hard reboot, verify `basis-postgres.service` brings Postgres up healthcheck-gated and all timers come back active. `Type=oneshot` units showing `Active: inactive (dead)` after success is the pass signal.
- [ ] **Phase 8 — weekly operational checks** (ongoing). Timer health, journal scan for `code=exited, status=0/SUCCESS`, S3 backup integrity, healthchecks.io dashboard green, disk + swap usage.
- [ ] **Phase 8 — mid-May findings refresh** (~2026-05-27). Recompute analytics with ≥30 days of EC2 collection and refresh `findings.md` + landing-page numbers.
- [ ] **Tailscale (or AWS SSM Session Manager) setup** — only if home-IP rotation continues to break the security-group whitelist often. Workarounds, in order of friction: widen to `/24` → widen to `/16` → Tailscale → SSM.

### Phase 7 — Public deploy (waiting on UI polish)

Caddy reverse proxy on EC2, Vercel-hosted frontend, DNS for `gpu-basis.xyz`. Triggered when polish is ready (1–2 weeks). See [basis-deployment-roadmap.md](../basis-deployment-roadmap.md) Phase 7.

### Phase 9 — Shutdown procedure (eventual)

Tear-down checklist when the project is wound down (~3 months out). See [basis-deployment-roadmap.md](../basis-deployment-roadmap.md) Phase 9.

### Ongoing (post-Phase-6)

- [ ] **Let data accumulate.** Writeup currently uses a 3-day sample; residual estimates will stabilize with ≥30 days of cron-driven collection. Mid-May refresh tracked above.
- [ ] **Monitor for `skipped_unknown_gpu`** — any new GPU name from a provider requires a `canonicalize.py` addition.
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

- **Laptop-sleep cron misses.** macOS cron silently skips firings while the laptop is asleep. Manual `backend/collect_cron.sh` runs are the current mitigation. Consider `caffeinate -d` or Power Scheduler if the pattern is chronic.
- **Docker must be running at cron times.** If Docker Desktop isn't up, collection succeeds at the HTTP layer but fails to persist. Enable "Start on login" in Docker Desktop.
- **Provider API shape changes.** TensorDock's `gpus` field changed shape (dict → list) once during the build. Watch parse-error logs on every run.

---

## Deprecated / parked

- **Lambda Labs collector** (`backend/basis/collectors/lambda_labs.py`) — code retained but not registered in `run_collect.py`. See [decisions/adr-log.md](../decisions/adr-log.md) ADR-003.
- **Scheduler module** (`backend/basis/scheduler/`) — APScheduler was scaffolded but not used. Cron drives collection instead.
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
