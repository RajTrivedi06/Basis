---
title: Dev Commands
tags: [area:overview, audience:developers, status:active]
owner: Raj
last_updated: 2026-06-23
---

# Dev Commands

## Polish-loop commands (production data on EC2)

Canonical walkthrough (three terminals, `~/.ssh/config`, **restart after every `git pull`**, gotchas, shutdown): **[../guides/dev-setup.md](../guides/dev-setup.md#run-against-production-data-polish-loop)**.

- **Start FastAPI on EC2 (once per session):** `ssh basis-prod` → `pkill -f uvicorn || true` → `cd ~/Basis/backend` → `nohup uv run uvicorn basis.api.main:app --host 127.0.0.1 --port 8000 > /tmp/uvicorn.log 2>&1 &` → `sleep 3` → `curl -s http://localhost:8000/health` → `exit`
- **Tunnel (Mac):** `ssh -L 8000:127.0.0.1:8000 -N basis-prod`
- **Frontend (Mac, from repo):** `cd frontend` → `npm run dev`
- **Stop uvicorn on EC2:** `ssh basis-prod` → `pkill -f uvicorn`
- **After `git pull` on EC2:** always restart uvicorn (same `nohup` line as above after `pkill`) — see **[../guides/dev-setup.md#restart-uvicorn-after-every-git-pull-on-ec2-critical](../guides/dev-setup.md#restart-uvicorn-after-every-git-pull-on-ec2-critical)**
- **Inspect uvicorn log:** `ssh basis-prod` → `tail -50 /tmp/uvicorn.log`

## What this file is for

A flat reference for every command you'll run during development. Grouped by what you're doing.

## When to read/use this

- You know what you want to do but forgot the exact command.
- Writing docs or scripts that reference a command.

---

## Database (Docker)

```bash
# Start Postgres
docker compose up -d

# Stop (keeps data volume)
docker compose stop

# Stop and remove (destroys data)
docker compose down -v

# Shell into the DB
docker exec -it basis-db-1 psql -U basis -d basis

# One-off SQL
docker exec basis-db-1 psql -U basis -d basis -c "SELECT count(*) FROM raw_observations;"
```

---

## Collection

Run from `backend/` (uv picks up the project automatically).

```bash
# All enabled collectors, save to DB
uv run python run_collect.py

# Dry-run (prints summary, does not save)
uv run python run_collect.py --dry-run

# Specific collector
uv run python run_collect.py vast
uv run python run_collect.py runpod
uv run python run_collect.py aws_spot
uv run python run_collect.py tensordock

# Specific collector, dry-run
uv run python run_collect.py vast --dry-run
```

Lambda Labs was dropped (see [../01-architecture/adr/0003-skip-lambda-labs.md](../01-architecture/adr/0003-skip-lambda-labs.md)).

---

## Normalization

```bash
# Normalize all raw observations that don't yet have a canonical offer
uv run python run_normalize.py

# Wipe all canonical offers and re-normalize from scratch
# (useful when the mapping tables change)
uv run python run_normalize.py --reset
```

If `run_normalize.py` reports `skipped_unknown_gpu > 0`, a new GPU name has appeared that isn't in the mapping tables. Add it to `backend/basis/normalization/canonicalize.py`.

---

## Analytics

```bash
# Build daily aggregates + variance decomposition from canonical offers
uv run python run_analytics.py

# Wipe and rebuild analytics from scratch
uv run python run_analytics.py --reset
```

Run after `run_normalize.py`. `collect_cron.sh` runs this as the third step (collect → normalize → analytics), so scheduled runs keep `daily_aggregates` and `basis_decomposition` current.

---

## Migrations (Alembic)

```bash
cd backend

# Apply all pending migrations
uv run alembic upgrade head

# Create a new migration after changing models
uv run alembic revision --autogenerate -m "describe the change"

# Roll back one migration
uv run alembic downgrade -1

# See migration history
uv run alembic history
```

---

## API server

```bash
cd backend
uv run uvicorn basis.api.main:app --reload
```

- App: `http://localhost:8000`
- OpenAPI docs: `http://localhost:8000/docs`

---

## Frontend

```bash
cd frontend

npm install           # first time or after package.json changes
npm run dev           # dev server, hot reload
npm run build         # production build
npm run lint          # ESLint
```

Frontend runs on `http://localhost:3000`.

---

## Tests

```bash
cd backend
uv run pytest                              # all tests
uv run pytest tests/test_normalization.py  # one module
uv run pytest -v --tb=short                # verbose, short tracebacks
uv run pytest --cov=basis                  # with coverage
```

---

## Lint / format / types

```bash
cd backend
uv run ruff check .           # lint
uv run ruff format .          # format
uv run mypy basis/            # type check
```

---

## Scheduled collection

In production, collection runs on EC2 via a systemd timer (`basis-collect.timer`, 08:00 / 20:00 UTC, `Persistent=true`), not laptop cron:

```bash
# On EC2 (ssh basis-prod):
systemctl list-timers basis-collect.timer        # last / next firing
journalctl -u basis-collect.service -n 100       # recent run output
```

A local laptop crontab is dev-only / optional:

```bash
crontab -l                    # see current jobs
crontab -e                    # edit
# 0 8,20 * * * /Users/raaj/Documents/CS/Basis/backend/collect_cron.sh

tail -f backend/logs/collect.log   # tail the local log
```

---

## Sanity-check queries

```sql
-- Observations per source
SELECT source, count(*) FROM raw_observations GROUP BY source ORDER BY source;

-- Canonical offers per provider & commitment
SELECT provider, commitment_type, count(*)
FROM canonical_offers
GROUP BY 1,2 ORDER BY 1,2;

-- H100 SXM cross-provider comparison
SELECT provider, commitment_type, count(*) AS n,
       min(price_usd_per_hour)::numeric(10,2) AS mn,
       round(avg(price_usd_per_hour)::numeric, 2) AS av,
       max(price_usd_per_hour)::numeric(10,2) AS mx
FROM canonical_offers
WHERE gpu_sku_canonical = 'h100_sxm_80gb'
GROUP BY 1,2 ORDER BY 1,2;
```
