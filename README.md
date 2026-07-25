# Basis

**Measuring basis risk in quoted GPU prices.**

> For H100 SXM 80GB across **77 days** of EC2-era collection (2026-04-26 → 2026-07-11), the residual share of log-price variance is **~60%** when including all providers in the corpus (Vast.ai, RunPod, AWS EC2 Spot, TensorDock), but **~82%** when excluding Vast.ai — which accounts for ~75% of canonical offers in that window. The headline depends on which segment of the market you measure, and that conditionality is itself the finding.

Both numbers are *basis risk* benchmark designs have to live with. Read the full writeup: **[docs/findings.md](docs/findings.md)** or the live dashboard at **https://gpu-basis.xyz**.

---

## What this is

In commodity derivatives, *basis* is the gap between a benchmark price and what a specific buyer actually pays. For GPU compute, that gap is enormous — H100 prices vary by 15× across providers on the same day for the same nominal hardware. Basis is a public-data study that quantifies how much of that dispersion is explainable by observable factors and how much remains as genuine, irreducible basis.

- **Study, not a SaaS.** No user accounts, no pricing, no product.
- **Public data, zero cost.** **3 active collectors** (Vast.ai, RunPod, AWS EC2 Spot). Lambda Labs was dropped (payment method required for API key). TensorDock is parked (public feed drained, 2026-07-13).
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
- **FastAPI** serves 11 read endpoints across 8 route modules: `/health`, `/api/offers`, `/api/dispersion/{sku}`, `/api/basis/{sku}` + `/api/basis/{sku}/timeseries`, `/api/providers`, `/api/gpu-skus`, `/api/fungibility-matrix`, and 3 provenance endpoints (`/api/provenance/decomposition/{sku}/observations`, `/api/provenance/raw-observation/{id}`, `/api/provenance/raw-observation/{id}/explain`).
- **Next.js** renders the dashboard with hand-rolled SVG charts (no Tremor) and a landing page that opens with the finding.

Full architecture: **[docs/01-architecture/system-overview.md](docs/01-architecture/system-overview.md)**.

## Current state

| Phase | Status |
|-------|--------|
| 0 — Scaffold | ✅ |
| 1 — Data collection (3 active; TensorDock parked) | ✅ |
| 2 — Normalization | ✅ (see [project-status](docs/project-status.md) for current volumes) |
| 3 — Analytics | ✅ |
| 4 — API (11 endpoints live) | ✅ |
| 5 — Frontend (5 pages, hand-rolled SVG charts) | ✅ |
| 6 — Writeup & polish | ✅ |
| 7 — Deploy | 🟢 Public (Vercel + Caddy + DNS); Phase 7.4 `basis-api.service` not shipped — [manual `nohup` uvicorn](docs/guides/dev-setup.md#known-operational-debt) |

Detailed status: **[docs/TASKS/README.md](docs/TASKS/README.md)**. Phase plan: **[docs/roadmap.md](docs/roadmap.md)**.

## Quickstart

### Run against production data (day-to-day)

Public dashboard: **https://gpu-basis.xyz** (Vercel). API: **https://api.gpu-basis.xyz** (EC2). Default UI work: **local Next.js** + **SSH tunnel** to FastAPI on EC2 (live Postgres + collectors). Configure **`Host basis-prod`** in `~/.ssh/config` first (keepalives + `ServerAliveInterval` / `ServerAliveCountMax` — see **[docs/guides/dev-setup.md](docs/guides/dev-setup.md#one-time-sshconfig-entry-for-basis-prod)**).

**After every `git pull` on EC2, restart uvicorn** (stale in-memory code otherwise — no exceptions). Procedure: **[docs/guides/dev-setup.md](docs/guides/dev-setup.md#restart-uvicorn-after-every-git-pull-on-ec2-critical)**.

**Terminal 1 — EC2 (once per session), then disconnect; `uvicorn` stays up under `nohup`:**

```bash
ssh basis-prod
pkill -f uvicorn || true                    # kill any stale process
cd ~/Basis/backend
nohup uv run uvicorn basis.api.main:app --host 127.0.0.1 --port 8000 > /tmp/uvicorn.log 2>&1 &
sleep 3
curl -s http://localhost:8000/health        # verify before exiting
exit                                        # uvicorn keeps running (nohup)
```

**Terminal 2 — Mac (tunnel; no output when healthy is normal):**

```bash
ssh -L 8000:127.0.0.1:8000 -N basis-prod
```

**Terminal 3 — Mac (from repo root):**

```bash
cd frontend
npm install          # first time or after package.json changes
npm run dev
```

Open **http://localhost:3000**. Check the tunnel: `curl -s http://localhost:8000/health` on your Mac (expect JSON).

Gotchas (silent tunnel, idle drop, `Connection refused` spam, IP rotation, tunnel vs EC2 health, shutdown order): **[docs/guides/dev-setup.md](docs/guides/dev-setup.md)** (see **Gotcha:** sections).

### Run fully locally (initial setup / offline)

Docker Postgres + local FastAPI + local Next.js — for backend changes, collectors, migrations, or working without SSH. Not the day-to-day polish path.

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

Full setup (both paths): **[docs/guides/dev-setup.md](docs/guides/dev-setup.md)**. Command cheat-sheet: **[docs/00-start-here/dev-commands.md](docs/00-start-here/dev-commands.md)**.

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
│   ├── components/           SkuPicker, BasisDecompositionChart, FungibilityMatrix, charts/ (hand-rolled SVG, e.g. DecompBar)
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
