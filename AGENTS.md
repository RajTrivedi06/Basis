# Agents Guide

This file is the entry point for AI coding agents (Claude Code, Cursor, Codex, etc.) working on Basis.

## What Is Basis?

Basis is a public-data study that quantifies GPU compute fungibility across cloud providers. It collects quoted H100 prices from 4 sources, normalizes them into a canonical schema, and decomposes price variance into observable factors (region, commitment type, bundled resources) vs. residual basis risk. It is a research study with an interactive dashboard, not a SaaS product or price aggregator.

## Quick Orientation

**Before anything else, read these in order:**

1. [docs/project-status.md](docs/project-status.md) — current phase, data volumes, what's next.
2. [docs/INDEX.md](docs/INDEX.md) — full doc index.
3. [docs/05-llm/DOC_MAP.md](docs/05-llm/DOC_MAP.md) — task-to-doc routing for agents.

| What you're looking for | Where to find it |
|---|---|
| Full project context & motivation | `Basis_Project_Proposal.md` (repo root) |
| Architecture & data flow | [docs/01-architecture/system-overview.md](docs/01-architecture/system-overview.md) |
| Data sources (per provider) | [docs/02-reference/data-sources.md](docs/02-reference/data-sources.md) |
| Database schema | [docs/02-reference/database.md](docs/02-reference/database.md) |
| API reference | [docs/02-reference/api.md](docs/02-reference/api.md) |
| Config & env vars | [docs/02-reference/config-and-env.md](docs/02-reference/config-and-env.md) |
| Guides (add collector, add normalization rule, etc.) | [docs/03-guides/](docs/03-guides/) |
| Troubleshooting | [docs/03-guides/troubleshooting.md](docs/03-guides/troubleshooting.md) |
| Architecture decisions (ADRs) | [docs/01-architecture/adr/](docs/01-architecture/adr/) |
| LLM context packs | [docs/05-llm/context-packs/](docs/05-llm/context-packs/) |
| Backend Python package | `backend/basis/` |
| Data collectors (one per provider) | `backend/basis/collectors/` |
| Normalization logic | `backend/basis/normalization/` |
| Analytics & decomposition (Phase 3, shipped) | `backend/basis/analytics/` |
| FastAPI routes | `backend/basis/api/routes/` |
| Pydantic schemas (data contracts) | `backend/basis/schemas/` |
| SQLAlchemy ORM models | `backend/basis/db/models.py` |
| Database config & engine | `backend/basis/db/engine.py` |
| App configuration | `backend/basis/config.py` |
| Alembic migrations | `backend/alembic/` |
| Backend tests | `backend/tests/` |
| Next.js frontend | `frontend/` |
| Frontend pages | `frontend/app/` |
| API client & types | `frontend/lib/` |

## Data Flow

```
Provider APIs/Pages
        |
        v
   Collectors          -- backend/basis/collectors/*.py
        |
        v
   raw_observations    -- immutable JSONB snapshots (write-once, never modify)
        |
        v
   Normalization       -- backend/basis/normalization/
        |
        v
   canonical_offers    -- standardized fields, linked to raw via FK
        |
        v
   Analytics           -- backend/basis/analytics/
        |
        v
   daily_aggregates    -- materialized metrics for fast queries
   basis_decomposition -- variance attribution results
        |
        v
   FastAPI             -- backend/basis/api/
        |
        v
   Next.js Dashboard   -- frontend/
```

## Adding a New Collector

This is the most common task. Follow these steps exactly:

1. **Create the collector file** at `backend/basis/collectors/<provider_name>.py`.

2. **Inherit from `BaseCollector`** (in `backend/basis/collectors/base.py`):
   ```python
   from basis.collectors.base import BaseCollector

   class MyProviderCollector(BaseCollector):
       source_name = "myprovider"

       async def collect(self) -> list[RawObservation]:
           # Fetch data from the provider's API or page
           # Return a list of RawObservation objects
           ...
   ```

3. **Each collector must:**
   - Set `source_name` to a unique lowercase identifier
   - Implement `async def collect()` returning `list[RawObservation]`
   - Store the full API response in `raw_payload` as JSONB (don't discard fields)
   - Extract at minimum: `gpu_model_reported`, `price_hourly`, `region_reported`, `commitment_type_reported`
   - Handle errors gracefully (network failures should log, not crash)

4. **Register the collector** in `backend/basis/collectors/__init__.py` by adding it to the `COLLECTORS` list.

5. **Add a normalization mapping** if the provider uses non-standard names for GPU models, regions, or commitment types. See `backend/basis/normalization/canonicalize.py`.

6. **Document the data source** in `docs/02-reference/data-sources.md` -- what URL, what auth (if any), rate limits, data format.

7. **Add a test** in `backend/tests/test_collectors.py` that validates the collector can parse a sample API response.

## Adding a New Normalization Rule

1. Identify which module the rule belongs to:
   - GPU SKU mapping -> `normalization/canonicalize.py`
   - Region mapping -> `normalization/region.py`
   - Commitment type mapping -> `normalization/commitment.py`
   - Bundle decomposition -> `normalization/bundle.py`

2. Add the mapping or rule to the appropriate module. Normalization rules should be **explicit** (lookup tables or clear conditionals), not ML models.

3. Add a test in `backend/tests/test_normalization.py` covering the new rule.

4. Be conservative. Only normalize factors that are clearly observable and documented. The residual variance is the interesting finding -- don't over-normalize.

## Running the Project

```bash
# Start the database
docker-compose up -d

# Backend (from repo root)
cd backend
uv sync                                          # install dependencies
uv run alembic upgrade head                      # run migrations
uv run uvicorn basis.api.main:app --reload       # start API server

# Frontend (from repo root)
cd frontend
npm install                                       # install dependencies
npm run dev                                       # start dev server
```

## Running Tests

```bash
cd backend
uv run pytest                           # all tests
uv run pytest tests/test_normalization.py  # specific module
uv run pytest -v --tb=short             # verbose with short tracebacks
uv run pytest --cov=basis               # with coverage
```

## Linting & Type Checking

```bash
cd backend
uv run ruff check .                     # lint
uv run ruff format .                    # format
uv run mypy basis/                      # type check
```

## Common Pitfalls

- **Don't modify `raw_observations` after insert.** They are the immutable audit trail. If you need to fix normalization, change the canonical_offers projection instead.
- **All timestamps are UTC.** Use `datetime.utcnow()` or `datetime.now(timezone.utc)`. Never use naive local times.
- **All prices are USD per GPU per hour.** If a provider quotes per-month or per-minute, convert during normalization.
- **Don't bypass `BaseCollector`.** Every collector must inherit from it to get consistent error handling, logging, and persistence.
- **Don't mix read-path and write-path code.** Collectors write raw data. Analytics read canonical data. The API reads aggregates. Keep these flows separate.
- **The planning document is the source of truth** for project scope and analytical framework. Read `Basis_Project_Proposal.md` before making design decisions.

## Commit Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(collectors): add TensorDock collector
fix(normalization): correct H100 SXM variant mapping
docs: update data source documentation for RunPod
test(analytics): add dispersion calculation tests
refactor(api): extract common query parameters to deps
```

## What NOT to Do

- **Don't add new top-level directories.** The structure is `backend/`, `frontend/`, `docs/`, `design/`, `specs/` (if created), `temp-doc/` (if created), plus root config files.
- **Don't mix read-path and write-path code** in the same module.
- **Don't create collectors that bypass `BaseCollector`.**
- **Don't add user accounts, auth, or multi-tenancy.** This is a public research tool.
- **Production is live** on AWS EC2 (Caddy -> FastAPI under `nohup`) and Vercel (`gpu-basis.xyz`, `api.gpu-basis.xyz`) since ~2026-05-12. Deployment configs are expected; keep them in sync with the live setup.
- **Don't add monitoring/observability frameworks** beyond Python's stdlib `logging`.
- **Don't build a trading simulator or derivatives pricing.** That was explicitly rejected in the planning phase.
- **Don't normalize too aggressively.** Conservative normalization preserves the residual variance finding.
- **Don't use ML models for normalization.** Rule-based adjustments are more interpretable and auditable.
