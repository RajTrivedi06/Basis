---
title: Documentation Index
tags: [area:overview, audience:all, status:active]
owner: Raj
last_updated: 2026-04-20
---

# Basis Documentation Index

Central navigation hub. Every other doc links back here.

---

## Read these first

- [project-brief.md](project-brief.md) — what Basis is, in one page.
- [project-status.md](project-status.md) — TL;DR of current phase and data volumes.
- [TASKS/README.md](TASKS/README.md) — detailed Done / In-progress / Pending / Blockers.
- [roadmap.md](roadmap.md) — high-level phases with entry/exit criteria.

## Entry points (root)

- [../README.md](../README.md) — project landing page.
- [../AGENTS.md](../AGENTS.md) — AI-agent entry point.
- [../CLAUDE.md](../CLAUDE.md) — Claude-specific workflow rules.
- [../Basis_Project_Proposal.md](../Basis_Project_Proposal.md) — planning doc / source of truth.

---

## By category

### Planning

- [project-brief.md](project-brief.md) — static overview.
- [roadmap.md](roadmap.md) — phases with status.
- [TASKS/README.md](TASKS/README.md) — detailed current work.
- [project-status.md](project-status.md) — TL;DR.
- [findings.md](findings.md) — **the analytical writeup** (Phase 6 output).
- [methodology.md](methodology.md) — analytical methodology.

### Start Here (`00-start-here/`)

- [quickstart.md](00-start-here/quickstart.md) — terse first-time setup.
- [dev-commands.md](00-start-here/dev-commands.md) — every command you'll run during development.

### Architecture (`01-architecture/`)

- [system-overview.md](01-architecture/system-overview.md) — four-layer pipeline, components, invariants.
- [data-flow.md](01-architecture/data-flow.md) — trace one observation from API to canonical offer.
- [adr/0001-template.md](01-architecture/adr/0001-template.md) — ADR template.
- [adr/0002-conservative-normalization.md](01-architecture/adr/0002-conservative-normalization.md) — why normalization is rule-based.
- [adr/0003-skip-lambda-labs.md](01-architecture/adr/0003-skip-lambda-labs.md) — why Lambda Labs is dropped.

### Reference (numbered — `02-reference/`)

Schemas, APIs, env config, data sources. Updated when the underlying contract changes.

- [data-sources.md](02-reference/data-sources.md) — every provider: endpoint, auth, cadence, quirks.
- [database.md](02-reference/database.md) — tables, columns, indexes.
- [api.md](02-reference/api.md) — REST endpoints (currently stubs; wired in Phase 4).
- [config-and-env.md](02-reference/config-and-env.md) — env vars, where `.env` lives, defaults.
- [observability.md](02-reference/observability.md) — logs, cron output, where to look when things break.

### Reference (named — `reference/`)

Domain-level reference. Longer form.

- [reference/domain-model.md](reference/domain-model.md) — core entities: raw observation, canonical offer, GPU SKU, commitment, region, bundle, aggregate, decomposition.

### Guides (numbered — `03-guides/`)

Step-by-step how-tos.

- [add-collector.md](03-guides/add-collector.md) — add a new provider.
- [add-normalization-rule.md](03-guides/add-normalization-rule.md) — extend the mapping tables.
- [run-collection.md](03-guides/run-collection.md) — manual collection, dry-run, reset.
- [troubleshooting.md](03-guides/troubleshooting.md) — common failures and fixes.

### Guides (named — `guides/`)

Operational and lifecycle guides.

- [dev-setup.md](guides/dev-setup.md) — thorough first-time developer setup.
- [operations-runbook.md](guides/operations-runbook.md) — daily ops, health checks, incident response.
- [testing.md](guides/testing.md) — current coverage and what to add.
- [deployment.md](guides/deployment.md) — deferred; stub describing the intended approach.

### Decisions (`decisions/`)

- [adr-log.md](decisions/adr-log.md) — one-page summary index of all ADRs.

### LLM Context (`05-llm/`)

Optimized for AI agents (copy-paste into context or follow the routing table).

- [DOC_MAP.md](05-llm/DOC_MAP.md) — task-to-doc routing table.
- [context-packs/collectors-pack.md](05-llm/context-packs/collectors-pack.md) — collector layer.
- [context-packs/normalization-pack.md](05-llm/context-packs/normalization-pack.md) — normalization layer.
- [context-packs/analytics-pack.md](05-llm/context-packs/analytics-pack.md) — analytics layer (Phase 3 planning).

---

## Conventions

- Every substantive doc starts with YAML frontmatter (`title`, `tags`, `owner`, `last_updated`) and a **What this file is for** / **When to read/use this** opening.
- Numbered folders (`00-`, `01-`, etc.) = ordered reading path.
- Named folders (`guides/`, `reference/`, `decisions/`) = category-based, longer-form reference.
- `05-llm/` is for agents — denser, more routing-focused, higher information density.
- Temp docs (investigation reports, one-off analyses) go in `temp-doc/` at repo root, **never** in `docs/`.

## Tag legend

Frontmatter tags use:

- `area:` — `overview`, `reference`, `guides`, `decisions`, `planning`.
- `audience:` — `all`, `developers`, `ops`.
- `status:` — `active`, `stub`, `deprecated`.

## Old redirects

- `docs/data_sources.md` → use [02-reference/data-sources.md](02-reference/data-sources.md).
- `docs/schema.md` → use [02-reference/database.md](02-reference/database.md).
