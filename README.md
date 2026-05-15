# Basis

**Measuring basis risk in quoted GPU prices.**

> For H100 SXM 80GB across 18 days of EC2-era collection, the residual share of log-price variance is **~59%** when including all four providers (Vast.ai, RunPod, AWS EC2 Spot, TensorDock), but **~89%** when excluding Vast.ai — which accounts for 80% of canonical offers. The headline depends on which segment of the market you measure, and that conditionality is itself the finding.

Both numbers are *basis risk* benchmark designs have to live with. Read the full writeup: **[docs/findings.md](docs/findings.md)** or the rendered version at `/` once the frontend is running.

---

## What this is

In commodity derivatives, *basis* is the gap between a benchmark price and what a specific buyer actually pays. For GPU compute, that gap is enormous — H100 prices vary by 15× across providers on the same day for the same nominal hardware. Basis is a public-data study that quantifies how much of that dispersion is explainable by observable factors and how much remains as genuine, irreducible basis.

- **Study, not a SaaS.** No user accounts, no pricing, no product.
- **Public data, zero cost.** Four providers. Lambda Labs was dropped because the free API key required a payment method.
- **Quoted prices, not transactions.** Transaction benchmarks like Ornn's OCPI are gated — the gap between quoted and transacted is exactly the market friction Basis exists to quantify.

## The four-layer pipeline

```
Provider APIs/Pages → collectors → raw_observations (immutable JSONB)
                                        │
                                        ▼
                                   normalization → canonical_offers
                                        │
                                        ▼
                                    analytics → daily_aggregates
                                                 basis_decomposition
                                        │
                                        ▼
                                      FastAPI → Next.js dashboard
```

- **Collectors** (one per provider, inherit `BaseCollector`) write raw observations twice daily.
- **Normalization** maps provider-specific strings to canonical SKUs / commitments / regions via explicit lookup tables — rule-based, conservative, no ML.
- **Analytics** runs sequential ANOVA on log-prices and writes dispersion + decomposition into materialized tables.
- **FastAPI** serves six read endpoints (`/api/offers`, `/api/dispersion/{sku}`, `/api/basis/{sku}`, `/api/providers`, `/api/gpu-skus`, `/health`).
- **Next.js** renders the dashboard with Tremor charts and a landing page that opens with the finding.

Full architecture: **[docs/01-architecture/system-overview.md](docs/01-architecture/system-overview.md)**.

## Current state

| Phase | Status |
|-------|--------|
| 0 — Scaffold | ✅ |
| 1 — Data collection (4 providers) | ✅ |
| 2 — Normalization (9,979 canonical offers, 97 SKUs) | ✅ |
| 3 — Analytics (465 aggregates, 179 decompositions) | ✅ |
| 4 — API (6 endpoints live) | ✅ |
| 5 — Frontend (4 pages, 3 Tremor charts) | ✅ |
| 6 — Writeup & polish | ✅ |
| 7 — Deploy | deferred |

Detailed status: **[docs/TASKS/README.md](docs/TASKS/README.md)**. Phase plan: **[docs/roadmap.md](docs/roadmap.md)**.

## Quickstart

```bash
# 1. Start the database
docker compose up -d

# 2. Set up env files
cp .env.example .env                           # then add AWS credentials
cp frontend/.env.example frontend/.env.local

# 3. Backend (from repo root)
cd backend
uv sync
uv run alembic upgrade head

# 4. Run the pipeline at least once
uv run python run_collect.py
uv run python run_normalize.py
uv run python run_analytics.py

# 5. Serve the API and the dashboard in two terminals
uv run uvicorn basis.api.main:app --reload    # backend on :8000
cd ../frontend && npm install && npm run dev  # frontend on :3000
```

Full setup: **[docs/guides/dev-setup.md](docs/guides/dev-setup.md)**. Command cheat-sheet: **[docs/00-start-here/dev-commands.md](docs/00-start-here/dev-commands.md)**.

## Structure

```
Basis/
├── backend/            FastAPI + collectors + normalization + analytics
│   ├── basis/
│   │   ├── collectors/       one file per provider
│   │   ├── normalization/    canonicalize / commitment / region / bundle
│   │   ├── analytics/        dispersion + sequential ANOVA decomposition
│   │   ├── api/              FastAPI routes
│   │   ├── db/               SQLAlchemy models, engine
│   │   └── schemas/          Pydantic models
│   ├── alembic/              migrations
│   ├── run_collect.py        collection CLI
│   ├── run_normalize.py      normalization CLI
│   ├── run_analytics.py      analytics CLI
│   └── collect_cron.sh       cron wrapper (collect → normalize → analytics)
├── frontend/           Next.js 15 dashboard
│   ├── app/                  routes: /, /dispersion, /basis, /providers, /methodology
│   ├── components/           SkuPicker, DispersionChart, BasisDecompositionChart, ProviderComparisonChart
│   └── lib/                  typed API client + types
├── docs/               documentation (see INDEX.md)
└── docker-compose.yml  Postgres 16
```

## Documentation

- **Start:** [docs/INDEX.md](docs/INDEX.md)
- **What Basis is:** [docs/project-brief.md](docs/project-brief.md)
- **The finding:** [docs/findings.md](docs/findings.md)
- **Method detail:** [docs/methodology.md](docs/methodology.md)
- **Current status:** [docs/project-status.md](docs/project-status.md)
- **For AI agents:** [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md), [docs/05-llm/DOC_MAP.md](docs/05-llm/DOC_MAP.md)

## License

MIT
