# Doc Map — Routing Table for AI Agents

## What this file is for

Task-to-doc routing. If you're an AI agent about to work on X, this tells you which docs to load into context first.

## When to read/use this

- At the start of any agent session.
- When the user gives a task and you need context.
- Before spawning subagents — include the relevant pack in the subagent prompt.

---

## Hierarchy reminder

- Source of truth for project scope: `Basis_Project_Proposal.md` (repo root).
- Entry point for agents: `AGENTS.md` (repo root).
- Claude-specific workflow: `CLAUDE.md` (repo root).
- Current phase & data volumes: `docs/project-status.md`.
- Full index of docs: `docs/INDEX.md`.

---

## Task routing

| If you are doing... | Read first | Read second |
|---------------------|-----------|-------------|
| Onboarding / first-time | `docs/INDEX.md` | `docs/project-status.md`, `docs/00-start-here/quickstart.md` |
| Adding a new collector | `docs/03-guides/add-collector.md` | `context-packs/collectors-pack.md`, `docs/02-reference/data-sources.md` |
| Fixing a collector bug | `context-packs/collectors-pack.md` | `docs/02-reference/data-sources.md` for the specific provider |
| Adding a normalization rule | `docs/03-guides/add-normalization-rule.md` | `context-packs/normalization-pack.md`, `docs/01-architecture/adr/0002-conservative-normalization.md` |
| Fixing a normalization skip | `context-packs/normalization-pack.md` | `docs/03-guides/add-normalization-rule.md` |
| Working on analytics | `context-packs/analytics-pack.md` | `docs/02-reference/database.md` |
| Writing or fixing an API route | `docs/02-reference/api.md` | `backend/basis/api/` source |
| Frontend chart work | `docs/02-reference/api.md` | `frontend/` source |
| Schema change | `docs/02-reference/database.md` | `backend/basis/db/models.py` source |
| Environment / config | `docs/02-reference/config-and-env.md` | `backend/basis/config.py` source |
| Something is broken | `docs/03-guides/troubleshooting.md` | `docs/02-reference/observability.md` |
| Architectural decision | `docs/01-architecture/adr/` (all ADRs) | `docs/01-architecture/system-overview.md` |

---

## Context packs

Dense bundles for agents. Copy into the subagent's prompt rather than pointing to files.

- [context-packs/collectors-pack.md](context-packs/collectors-pack.md) — Everything needed to work on collectors.
- [context-packs/normalization-pack.md](context-packs/normalization-pack.md) — Normalization layer conventions and mappings.
- [context-packs/analytics-pack.md](context-packs/analytics-pack.md) — Analytics layer (dispersion, basis decomposition, aggregates).

---

## Non-negotiables (short-form)

- Raw observations are immutable. Never UPDATE or DELETE.
- All timestamps UTC. All prices USD/GPU/hour.
- Every collector inherits `BaseCollector`.
- Normalization is rule-based, conservative, explicit. No ML.
- Do not silently update `docs/`. Ask the user.
- Do not add new top-level directories.

---

## When docs and code disagree

Trust the code. If code behaves differently from docs, update the doc — but only after flagging it to the user. Memories, comments, and docs can go stale; the code is what runs.
