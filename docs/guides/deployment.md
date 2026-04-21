---
title: Deployment
tags: [area:guides, audience:ops, status:stub]
owner: Raj
last_updated: 2026-04-20
---

# Deployment

## Status: not deployed

Basis is a local-only project until Phase 7 (see [../roadmap.md](../roadmap.md)). This doc is a stub describing the intended approach when deployment does happen.

---

## Target architecture (planned)

| Component | Candidate host | Rationale |
|-----------|---------------|-----------|
| Frontend (Next.js) | Vercel | Native Next.js target, free hobby tier, instant previews. |
| Backend (FastAPI) | Railway or Fly.io | Simple container deploys, can run cron + web together. |
| Postgres | Railway's Postgres addon, or Neon / Supabase | Managed, free tier covers our data volume. |
| Cron (collection) | Same host as backend, or GitHub Actions (scheduled) | Decouple from laptop; see below. |

---

## Decisions still to make

- Host choice for backend (Railway vs Fly vs Render). Will be recorded as an ADR when chosen.
- Whether cron lives on the backend host, as a GitHub Actions schedule, or as a separate worker.
- Whether to keep `raw_observations.raw_payload` indefinitely or prune after a retention window.
- Public vs private deployment. Basis is a research tool, not a SaaS — likely public, read-only.

---

## What needs to happen before deploying

From [../TASKS/README.md](../TASKS/README.md):

- Phase 3 (analytics) complete — there's nothing to show until this lands.
- Phase 4 (API) wired to real data.
- Phase 5 (frontend) rendering real charts.
- Basic test coverage in `backend/tests/`.
- Env-variable audit to ensure nothing secret leaks into logs.

---

## Related

- [Roadmap — Phase 7 (deferred)](../roadmap.md#phase-7--deploy-deferred)
- [Config & env reference](../02-reference/config-and-env.md)
