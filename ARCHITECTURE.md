# Architecture

Basis has a four-layer pipeline architecture. Data flows in one direction: **collect -> normalize -> analyze -> serve**.

## Layers

### 1. Collectors (`backend/basis/collectors/`)

Scheduled jobs that pull GPU pricing data from each provider's public API or pricing page. Each collector inherits from `BaseCollector` and writes **raw observations** to the database. Raw observations are immutable -- once inserted, they are never modified.

**Providers:** Vast.ai, RunPod, AWS EC2 Spot, Lambda Labs, TensorDock.

### 2. Normalization (`backend/basis/normalization/`)

Transforms raw observations into **canonical offers** with standardized fields. This layer handles:
- GPU SKU canonicalization (e.g., "NVIDIA H100 SXM5 80GB" -> `h100_sxm_80gb`)
- Region normalization (provider-specific region names -> `country/region/city`)
- Commitment type mapping (provider-specific terms -> `on_demand`, `spot`, `reserved_1m`, etc.)
- Bundle decomposition (extracting vCPU, RAM, storage from bundled pricing)

Normalization is **conservative** -- only adjust for clearly observable, documented factors. The size of the residual variance is the interesting finding.

### 3. Analytics (`backend/basis/analytics/`)

Computes the project's core metrics from canonical offers:
- **Dispersion metrics** -- range, IQR, coefficient of variation for each GPU SKU per day
- **Basis decomposition** -- variance attribution to region, commitment, bundle, provider, and residual
- **Daily aggregates** -- materialized snapshots (median, p25, p75) for fast dashboard queries

### 4. API & Frontend (`backend/basis/api/`, `frontend/`)

- **FastAPI backend** exposes REST endpoints for offers, dispersion metrics, and basis decomposition
- **Next.js frontend** renders charts and the analytical narrative

## Data Flow

```
Provider APIs/Pages
        |
        v
  +-----------+       +----------------+       +------------+
  | Collectors | ----> | raw_observations| ----> | Normalizer |
  +-----------+       | (immutable)    |       +------------+
                      +----------------+              |
                                                      v
                                               +----------------+
                                               | canonical_offers|
                                               +----------------+
                                                      |
                                                      v
                                               +--------------+
                                               |  Analytics   |
                                               +--------------+
                                                /            \
                                               v              v
                                    +------------------+  +----------------------+
                                    | daily_aggregates |  | basis_decomposition  |
                                    +------------------+  +----------------------+
                                               \              /
                                                v            v
                                              +-----------+
                                              | FastAPI   |
                                              +-----------+
                                                    |
                                                    v
                                              +-----------+
                                              | Next.js   |
                                              | Dashboard |
                                              +-----------+
```

## Database Schema Rationale

The database uses three tiers of data:

1. **Immutable raw** (`raw_observations`) -- write-once, stores the exact API response as JSONB. This is the audit trail. Never modified after insert.

2. **Mutable canonical** (`canonical_offers`) -- normalized projection of raw data. Can be regenerated from raw observations if normalization logic changes. Each row links back to its raw observation via foreign key.

3. **Materialized aggregates** (`daily_aggregates`, `basis_decomposition`) -- precomputed metrics for fast API queries. Recomputed daily. These are the read-path optimization layer.

This separation means the write-path (collectors writing raw data) and read-path (API serving aggregates) never contend with each other.

## Key Invariants

- All timestamps are UTC.
- All prices are stored as USD per GPU per hour.
- Raw observations are never modified after insert.
- Each collector is self-contained in a single file inheriting from `BaseCollector`.
- Normalization rules are explicit and testable -- no implicit transformations.

## Directory Map

```
backend/basis/
  config.py          -- pydantic-settings configuration
  db/                -- SQLAlchemy engine, base, and ORM models
  schemas/           -- Pydantic models for data validation (raw, canonical, API)
  collectors/        -- one file per provider, all inherit BaseCollector
  normalization/     -- canonicalization, region mapping, commitment mapping
  analytics/         -- dispersion, basis decomposition, aggregation
  scheduler/         -- APScheduler job definitions
  api/               -- FastAPI app, dependencies, route modules

frontend/
  app/               -- Next.js App Router pages
  components/        -- React components (charts, layout)
  lib/               -- API client and TypeScript types
```
