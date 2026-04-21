# Quickstart

## What this file is for

Get Basis running on a fresh machine: prerequisites, setup steps, and how to verify everything works.

## When to read/use this

- First time cloning the repo.
- After a long pause, when you're not sure if your local env still works.
- When onboarding a collaborator.

---

## Prerequisites

- **Python 3.11+**
- **Node.js 20+**
- **Docker & Docker Compose** (for Postgres)
- **[uv](https://docs.astral.sh/uv/)** — Python package manager

Optional but useful:

- **AWS account** (free tier) with `ec2:DescribeSpotPriceHistory` permission (or `AmazonEC2ReadOnlyAccess` managed policy).

---

## Setup

```bash
# 1. Start the database
docker compose up -d

# 2. Copy env files
cp .env.example .env
cp frontend/.env.example frontend/.env.local
# Then edit .env to add any API keys you have (Vast, RunPod, AWS)

# 3. Install backend deps
cd backend
uv sync

# 4. Run migrations
uv run alembic upgrade head

# 5. (Optional) Do a dry-run collection from one source
uv run python run_collect.py vast --dry-run

# 6. Real collection — save to DB
uv run python run_collect.py          # all sources
# or a specific one
uv run python run_collect.py runpod

# 7. Normalize raw observations into canonical offers
uv run python run_normalize.py

# 8. Start the backend (in its own terminal)
uv run uvicorn basis.api.main:app --reload

# 9. Start the frontend (in another terminal, from repo root)
cd frontend
npm install
npm run dev
```

Backend: `http://localhost:8000` — OpenAPI docs at `/docs`.
Frontend: `http://localhost:3000`.

---

## Verify

```bash
# Check DB is up
docker exec basis-db-1 psql -U basis -d basis -c "SELECT count(*) FROM raw_observations;"

# Should show a non-zero count after step 6.
```

If you want to see the H100 cross-provider snapshot:

```bash
docker exec basis-db-1 psql -U basis -d basis -c "
SELECT provider, commitment_type, count(*) AS offers,
       min(price_usd_per_hour)::numeric(10,2) AS min,
       round(avg(price_usd_per_hour)::numeric, 2) AS avg,
       max(price_usd_per_hour)::numeric(10,2) AS max
FROM canonical_offers
WHERE gpu_sku_canonical = 'h100_sxm_80gb'
GROUP BY provider, commitment_type
ORDER BY provider, commitment_type;"
```

---

## Cron schedule (optional)

Twice-daily collection is already configured in `backend/collect_cron.sh`. To install:

```bash
crontab -e
# Add:
0 8,20 * * * /Users/raaj/Documents/CS/Basis/backend/collect_cron.sh
```

Logs go to `backend/logs/collect.log`. See [../02-reference/observability.md](../02-reference/observability.md).

---

## Next steps

- See [../project-status.md](../project-status.md) for what phase we're in.
- See [dev-commands.md](dev-commands.md) for the full command cheatsheet.
- See [../03-guides/troubleshooting.md](../03-guides/troubleshooting.md) if something breaks.
