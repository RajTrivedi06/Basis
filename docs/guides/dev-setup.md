---
title: Development Setup
tags: [area:guides, audience:developers, status:active]
owner: Raj
last_updated: 2026-04-20
---

# Development Setup

Detailed first-time setup for developers joining the project. For the terse version, see [../00-start-here/quickstart.md](../00-start-here/quickstart.md).

---

## System prerequisites

- **macOS or Linux.** Windows via WSL2 should work but isn't tested.
- **Python 3.11+** (`python3 --version`).
- **Node.js 20+** (`node --version`).
- **Docker Desktop** (or another Docker engine) — `docker --version` and `docker compose version`.
- **uv** — `brew install uv` or `curl -LsSf https://astral.sh/uv/install.sh | sh`.
- **Git** — `git --version`.

## Optional (but you'll want them)

- **AWS CLI** — not strictly required since we use `boto3`, but helpful for key management.
- **`jq`** — for exploring provider JSON responses.
- **`psql` client** — `brew install libpq && brew link --force libpq`. You can also always `docker exec` into the DB container.

---

## Step-by-step

### 1. Clone and enter the repo

```bash
git clone <repo-url>
cd Basis
```

### 2. Environment files

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env.local
```

Edit `.env`:

- `DATABASE_URL` — leave the default for local dev.
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — required for AWS Spot collector. Create an IAM user with `AmazonEC2ReadOnlyAccess` managed policy. See [../02-reference/config-and-env.md#aws-required-for-aws-spot-collector](../02-reference/config-and-env.md#aws-required-for-aws-spot-collector).
- `VAST_API_KEY` / `RUNPOD_API_KEY` — optional, grant higher rate limits.

### 3. Start Postgres

```bash
docker compose up -d
```

Verify:

```bash
docker exec basis-db-1 psql -U basis -d basis -c "SELECT version();"
```

### 4. Backend deps + migrations

```bash
cd backend
uv sync
uv run alembic upgrade head
```

`uv sync` creates `.venv/` and installs everything from `pyproject.toml` + `uv.lock`.

### 5. First collection

Dry-run first (no DB writes) to sanity-check:

```bash
uv run python run_collect.py vast --dry-run
```

Expected: a summary of offers grouped by GPU name. If you get `AWS credentials not configured`, check the `.env` location and contents.

Then a real run:

```bash
uv run python run_collect.py          # all 4 sources
uv run python run_normalize.py
```

### 6. Start the backend

In its own terminal:

```bash
cd backend
uv run uvicorn basis.api.main:app --reload
```

- App: `http://localhost:8000`
- OpenAPI: `http://localhost:8000/docs`

### 7. Start the frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:3000`.

---

## Editor config

No `.editorconfig` or `.vscode/` is committed. Reasonable defaults:

- Python formatter: `ruff format`.
- Python linter: `ruff check`.
- Type checker: `mypy` on the `basis/` package.
- TypeScript / React: default Next.js ESLint config.

---

## Cron (optional but recommended)

See [operations-runbook.md#cron](operations-runbook.md#cron).

---

## What's different about this setup

- **Run commands from `backend/`.** `pydantic-settings` walks up three directories from `basis/config.py` to find `.env` at the repo root. Running from `backend/` is the assumed workflow — running from repo root also works but hasn't been tested as rigorously.
- **Docker must be running at collection time.** Cron assumes Postgres is reachable. If you're using cron, enable "Start on login" in Docker Desktop.
- **No local Postgres needed.** The Docker container is the dev DB. No Homebrew Postgres required.

---

## Related

- [Quickstart (terse)](../00-start-here/quickstart.md)
- [Dev commands](../00-start-here/dev-commands.md)
- [Config & env](../02-reference/config-and-env.md)
- [Troubleshooting](../03-guides/troubleshooting.md)
