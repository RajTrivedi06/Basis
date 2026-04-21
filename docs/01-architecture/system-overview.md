# System Overview

## What this file is for

High-level architecture of Basis: the four-layer pipeline, the components in each layer, and the invariants that keep the system honest.

## When to read/use this

- Onboarding.
- Before making a change that crosses layer boundaries.
- When deciding where a new piece of logic belongs.

---

## The four layers

Data flows in one direction: **collect → normalize → analyze → serve**. Each layer has one job.

```
┌──────────────────┐
│   Provider APIs  │   Vast.ai, RunPod, AWS EC2 Spot, TensorDock
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   1. Collectors  │   backend/basis/collectors/*.py
└────────┬─────────┘
         │                (write-once JSONB snapshots)
         ▼
┌──────────────────┐
│ raw_observations │   immutable audit trail
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 2. Normalization │   backend/basis/normalization/
└────────┬─────────┘
         │                (rule-based, no ML)
         ▼
┌──────────────────┐
│ canonical_offers │   standardized SKU, region, commitment
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   3. Analytics   │   backend/basis/analytics/ (Phase 3)
└────────┬─────────┘
         │                (dispersion, variance decomposition)
         ▼
┌──────────────────┐
│daily_aggregates  │
│basis_decomposition│  materialized read-path
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│     4. API       │   backend/basis/api/ (FastAPI)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│    Next.js UI    │   frontend/
└──────────────────┘
```

---

## Layer 1 — Collectors

Each collector inherits from `BaseCollector` (`backend/basis/collectors/base.py`) and writes raw observations. One collector per provider, self-contained in a single file.

**Responsibilities:**
- Call the provider's API (or scrape, if no API).
- Extract minimum fields: `gpu_model_reported`, `price_hourly`, `region_reported`, `commitment_type_reported`.
- Store the **full** provider response in `raw_payload` (JSONB) — never discard fields.
- Log and skip on error; don't crash the whole run.

**Live collectors (4):** Vast.ai, RunPod, AWS Spot, TensorDock.

See [../02-reference/data-sources.md](../02-reference/data-sources.md) for per-provider details.

---

## Layer 2 — Normalization

Transforms raw observations into canonical offers. Rule-based; explicitly **not** ML.

**Four concerns, four files:**
- `canonicalize.py` — GPU name → canonical SKU (e.g., `"NVIDIA A100 SXM4 80GB"` → `a100_sxm_80gb`).
- `commitment.py` — provider-specific commitment labels → canonical types (`on_demand`, `spot`, `reserved_1m`, etc.).
- `region.py` — provider region strings → `(country, state, city)`.
- `bundle.py` — extract bundled resources (vCPU, RAM, storage) from provider metadata.

**Conservative by design.** When a GPU name isn't in the map, we skip and log — we don't guess. Over-normalizing would shrink the residual variance artificially and undermine the project's thesis. See [adr/0002-conservative-normalization.md](adr/0002-conservative-normalization.md).

---

## Layer 3 — Analytics (Phase 3, not yet implemented)

Consumes canonical offers, produces aggregates.

**Planned:**
- Dispersion metrics — per (GPU SKU, day): median, p25, p75, IQR, CoV → `daily_aggregates`.
- Basis decomposition — ANOVA-style variance attribution to region / commitment / provider / bundle / residual → `basis_decomposition`.

Analytics never reads raw observations directly — it reads canonical offers. This keeps the math clean and the layer boundary strict.

---

## Layer 4 — API & Frontend

- **FastAPI** (`backend/basis/api/`) exposes REST endpoints that read from aggregates tables.
- **Next.js** (`frontend/`) renders the dashboard and narrative.

The API reads **only** from aggregate tables (`daily_aggregates`, `basis_decomposition`) — not from canonical offers directly. This is a read-path optimization.

---

## Invariants

These are the rules that don't bend.

| Invariant | Why it matters |
|-----------|----------------|
| All timestamps are UTC. | Cross-timezone data would poison daily aggregates. |
| All prices are USD per GPU per hour. | Convert per-month, per-instance, or per-minute at normalization time. |
| `raw_observations` is immutable after insert. | It's the audit trail. Breaks in reproducibility are hard to detect if raw data shifts. |
| Every collector inherits from `BaseCollector`. | Consistent error handling, logging, persistence. No ad-hoc collectors. |
| Read-path and write-path are separated. | Collectors write raw. Normalization writes canonical. Analytics writes aggregates. API reads aggregates. No layer skips. |
| Normalization is explicit, rule-based, testable. | No ML. No implicit transforms. Residual variance must be interpretable. |

---

## Key directories

```
backend/basis/
├── config.py              pydantic-settings, loads .env
├── db/                    engine, base, ORM models
├── schemas/               pydantic models (raw, canonical, API)
├── collectors/            one file per provider
├── normalization/         canonicalize, commitment, region, bundle, pipeline
├── analytics/             (Phase 3) dispersion, basis decomposition
├── scheduler/             (unused; cron drives collection)
└── api/                   FastAPI app, routes

backend/
├── alembic/               DB migrations
├── tests/
├── run_collect.py         collector entry point
├── run_normalize.py       normalization entry point
└── collect_cron.sh        cron wrapper

frontend/
├── app/                   Next.js App Router pages
├── components/            React components
└── lib/                   API client, types
```

## Deployment notes

Not deployed. Local dev only until the app is feature-complete. See [ADR 0004 would cover this] — none recorded yet. Planned targets are Vercel (frontend) and Railway (backend + DB) but decision is deferred.
