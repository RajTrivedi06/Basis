---
title: Roadmap
tags: [area:planning, audience:all, status:active]
owner: Raj
last_updated: 2026-06-23
---

# Roadmap

High-level phase plan. Each phase has a clear entry and exit criterion. Detailed work status is in [TASKS/README.md](TASKS/README.md).

---

## Phase 0 — Scaffold

Status: `COMPLETE`

- Repo structure (backend, frontend, docs) created.
- Python / uv / pyproject.toml set up.
- Next.js 15 frontend skeleton in place.
- Docker Compose with PostgreSQL.
- Alembic migrations; initial schema (`raw_observations`, `canonical_offers`, `daily_aggregates`, `basis_decomposition`).
- Pydantic schemas defining data contracts.
- AGENTS.md, ARCHITECTURE.md, README.md.

---

## Phase 1 — Data Collection

Status: `COMPLETE` (4/5 providers; Lambda Labs dropped)

- `BaseCollector` contract (async `collect()` returning `list[RawObservationCreate]`).
- **Vast.ai** collector (REST) — ~2,800 obs/run.
- **RunPod** collector (GraphQL) — ~190 obs/run.
- **AWS EC2 Spot** collector (boto3) — ~300 obs/run across 7 regions.
- **TensorDock** collector (REST) — ~35 obs/run across 22 locations.
- **Lambda Labs** — code written but dropped (required payment method to issue free API key — see ADR 0003).
- Cron schedule: 08:00 and 20:00 daily via `backend/collect_cron.sh`.
- Persistence layer (`collectors/persist.py`).
- Dry-run support across all collectors.

**Exit criterion met:** ≥ 4 providers producing raw observations on a schedule without manual intervention.

---

## Phase 2 — Normalization

Status: `COMPLETE`

- `canonicalize.py` — 180+ GPU name mappings → canonical SKUs (`h100_sxm_80gb` etc.).
- `commitment.py` — on_demand / spot / reserved_{1w,1m,3m,6m,1y,3y}.
- `region.py` — per-source parsers (AWS AZs, Vast geolocation, TensorDock city/state/country).
- `bundle.py` — extract vCPU, RAM, storage, verification tier from provider metadata.
- `pipeline.py` orchestrates the transformation.
- `run_normalize.py` script with `--reset`.
- 9,979 canonical offers created; **0 skipped_unknown_gpu**.

**Exit criterion met:** all raw observations normalize into canonical offers; H100 SXM is comparable across all 4 providers.

---

## Phase 3 — Analytics

Status: `COMPLETE`

- `analytics/dispersion.py` — per (date, gpu_sku) and per (date, gpu_sku, provider) median, p25, p75. Min 3 obs per bucket. Shipped.
- `analytics/basis.py` — **sequential ANOVA on log-prices**, fixed order: region → commitment → provider → bundle → residual. NULL factor values preserved as a distinct "UNKNOWN" group. Bundle composite = z-normalized (vCPUs + RAM + storage) bucketed into quartiles. Min 5 obs per (date, gpu_sku). Shipped.
- `analytics/aggregates.py` — orchestrator that pulls canonical offers, runs both modules, upserts idempotently into `daily_aggregates` and `basis_decomposition`. Shipped.
- `run_analytics.py` CLI with `--reset`, `--date`, `--gpu-sku`. Shipped.
- `backend/collect_cron.sh` chained: collect → normalize → analytics. Shipped.
- First run outputs: 465 daily aggregates, 179 (date, gpu_sku) decompositions across 3 days.

**Exit criterion met:** H100 SXM end-to-end verified. Integrity check (components + residual = total) passes for every row.

**Current headline finding (segment-conditional, 18-day EC2 window):** H100 SXM residual variance is **~59% (Vast included) / ~89% (Vast excluded)** of log-price variance — the defensible, publishable Basis finding. (The first run reported a **53%–95%** range across only 3 observation days; that figure is superseded by the segment-conditional headline. See [findings.md](findings.md).)

**Caveat for Phase 6 writeup:** sequential attribution order matters (region first → absorbs provider variance on AWS-heavy days). To be documented in `methodology.md`.

---

## Phase 4 — API Endpoints

Status: `COMPLETE`

- `GET /api/offers` — canonical_offers with filters (`gpu_sku`, `provider`, `commitment_type`, `region_country`, `since`, `until`) and pagination. Shipped.
- `GET /api/dispersion/{gpu_sku}` — time series from `daily_aggregates` with optional date range and per-provider slicing. IQR computed on the fly; CoV left null for now. Shipped.
- `GET /api/basis/{gpu_sku}` — latest-by-default decomposition with `pct_explained` and `pct_residual` derived. 404 on missing. Shipped.
- `GET /api/providers` — per-provider offer counts, SKU coverage, and median deviation vs. market median on the latest date. Shipped.
- `GET /api/gpu-skus` — canonical SKU list with offer/provider counts and latest median price. Shipped.
- Health endpoint already existed.

**Per-endpoint tests are still a nice-to-have** (tracked in TASKS) — not a Phase 4 blocker.

**Exit criterion met:** every endpoint returns live data from the real tables. Smoke tests via curl show filters, pagination, and 404s behaving correctly. The frontend can now fetch all chart data from real endpoints.

---

## Phase 5 — Frontend Dashboard

Status: `COMPLETE`

- Typed API client (`frontend/lib/api.ts`) hitting all 5 data endpoints plus `/health`. Handles error messaging by reading FastAPI's `detail` field.
- React Query wrapper (`components/providers.tsx`) for caching.
- `SkuPicker` dropdown fed by `/api/gpu-skus`, sorted by offer count (so H100 / A100 / RTX 4090 surface first).
- `DispersionChart` — Tremor `LineChart` with p25 / median / p75 lines.
- `BasisDecompositionChart` — Tremor `DonutChart` + side panel with the residual percentage as the hero number, plus an attribution table.
- `ProviderComparisonChart` — Tremor `BarChart` for deviation, plus coverage table.

> **Note (ADR 0005):** Tremor was later removed in the v2 residual-first redesign; the charts above were replaced by hand-rolled SVG components (`FactorStripPlot`, `ResidualTimeSeriesChart`, `components/charts/DecompBar`). The Tremor descriptions here are kept as the Phase 5 historical record.
- Four pages wired: `/` (dispersion), `/basis`, `/providers`, `/methodology`. Methodology page fully rewritten with real method description and caveats.
- **React downgraded from 19 → 18** to match Tremor's peer constraint (ADR-worthy note — Next.js 15 supports both).
- `npm run build` passes cleanly; `npm run dev` + backend round-trip verified (all pages and proxied API routes return 200).

**Exit criterion met:** a visitor landing on `/` sees the H100 SXM dispersion chart with real data, can switch SKUs, and can navigate to `/basis` for the residual variance headline.

---

## Phase 6 — Analytical Writeup & Polish

Status: `COMPLETE`

- [findings.md](findings.md) — ~1200-word analytical piece: lead, what Basis is, method, the H100 SXM numbers, why the residual is large (reliability / availability / marketplace mechanism), implications for compute benchmarks, limitations.
- Frontend restructured: `/` → findings landing with hero claim + 3-day decomposition table + navigation cards; dispersion chart moved to `/dispersion`; nav updated.
- Root [`README.md`](../README.md) rewritten — leads with the residual finding, keeps project structure and quickstart.
- [methodology.md](methodology.md) had already been filled in during Phase 3 (method frozen + first-pass H100 findings).
- Honest disclosure: 3-day sample, quoted-vs-transacted gap, 4-provider coverage, conservative-by-design normalization — all stated on the landing page, findings page, and methodology page.
- `npm run build` clean after restructure; all 5 routes (`/`, `/dispersion`, `/basis`, `/providers`, `/methodology`) compile.

**Exit criterion met:** the site opens with the finding, the writeup stands on its own, and the README leads a visitor to the thesis within 5 seconds.

---

## Phase 7 — Deploy

Status: `SHIPPED / LIVE` (public deploy ~2026-05-12)

Production is live: **https://gpu-basis.xyz** (Vercel frontend) and **https://api.gpu-basis.xyz** (EC2 + Caddy backend). The pipeline runs on AWS EC2 (`us-east-1`) under systemd timers; Phases 0–6 of [basis-deployment-roadmap.md](basis-deployment-roadmap.md) shipped 2026-04-27 and the public surfaces went live ~2026-05-12.

**Caveat — Phase 7.4 (`basis-api.service`) not shipped.** FastAPI still runs under manual `nohup` rather than as a systemd service, so a `git pull` on EC2 requires a manual uvicorn restart. See [project-status.md](project-status.md#known-operational-debt) and [basis-deployment-roadmap.md](basis-deployment-roadmap.md) Phase 7.4.
