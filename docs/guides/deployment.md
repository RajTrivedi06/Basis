---
title: Deployment
tags: [area:guides, audience:ops, status:active]
owner: Raj
last_updated: 2026-06-23
---

# Deployment

## Status: live

Production has been live since ~2026-05-12:

| Component | Host | Notes |
|-----------|------|-------|
| Frontend (Next.js) | Vercel | Public site. |
| Backend (FastAPI) | AWS EC2 | Served behind Caddy (TLS / reverse proxy); the app runs under `nohup uv run uvicorn ...`. |
| Postgres | AWS EC2 (Docker Compose) | Same instance; `POSTGRES_PASSWORD` set to a strong random value. |
| Collection | AWS EC2 systemd timers | `basis-collect.timer` fires at 08:00 / 20:00 UTC (`Persistent=true`), running `collect_cron.sh` (collect → normalize → analytics). Not laptop cron. |

---

## Where the specifics live

- **Operating the live stack** (restart uvicorn after `git pull`, health checks, systemd timers): [operations-runbook.md](operations-runbook.md) and [dev-setup.md](dev-setup.md#run-against-production-data-polish-loop).
- **How it was built / the deployment plan:** [../basis-deployment-roadmap.md](../basis-deployment-roadmap.md).
- **Environment variables** (including `POSTGRES_PASSWORD`, CORS, and the healthchecks.io ping URLs): [../02-reference/config-and-env.md](../02-reference/config-and-env.md).

---

## Related

- [Operations runbook](operations-runbook.md)
- [Deployment roadmap](../basis-deployment-roadmap.md)
- [Config & env reference](../02-reference/config-and-env.md)
