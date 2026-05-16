---
title: Development Setup
tags: [area:guides, audience:developers, status:active]
owner: Raj
last_updated: 2026-05-12
---

# Development Setup

How to run Basis in two modes: **polish loop** (local Next.js + SSH tunnel + production API on EC2 — day-to-day), and **fully local** (Docker Postgres + local FastAPI — initial setup, backend work, offline reproducibility). For a terse local-only checklist, see [../00-start-here/quickstart.md](../00-start-here/quickstart.md). Command cheat-sheet: [../00-start-here/dev-commands.md](../00-start-here/dev-commands.md).

**Production URLs:** dashboard **https://gpu-basis.xyz** (Vercel), API **https://api.gpu-basis.xyz** (EC2, Caddy → FastAPI). Collectors, Postgres, and timers run on EC2; FastAPI is **not** managed by systemd yet (Phase 7.4 `basis-api.service` never shipped — see [Known operational debt](#known-operational-debt) below).

---

## System prerequisites

- **macOS or Linux.** Windows via WSL2 should work but isn't tested.
- **Python 3.11+** (`python3 --version`) — required for **fully local** backend work; the polish loop runs `uv` on EC2, not necessarily on your laptop.
- **Node.js 20+** (`node --version`) — required for `npm run dev` on your Mac.
- **Git** — `git --version`.
- **SSH** — polish loop only: keypair + `basis-prod` [config entry](#one-time-sshconfig-entry-for-basis-prod) with inbound access on the EC2 security group (`basis-sg`).

**Fully local path also needs:**

- **Docker Desktop** (or another Docker engine) — `docker --version` and `docker compose version`.
- **uv** — `brew install uv` or `curl -LsSf https://astral.sh/uv/install.sh | sh`.

## Optional (but you'll want them)

- **AWS CLI** — not strictly required since we use `boto3`, but helpful for key management.
- **`jq`** — for exploring provider JSON responses.
- **`psql` client** — `brew install libpq && brew link --force libpq`. You can also always `docker exec` into the DB container.

---

## Run against production data (polish loop)

Use this when you are iterating on the **frontend** against **live** EC2 data. You need SSH access to the production host (security group allows your IP).

### One-time: `~/.ssh/config` entry for `basis-prod`

Add a `Host basis-prod` block with your real `HostName`, `User`, `IdentityFile`, **and** keepalives so idle tunnels do not drop:

```sshconfig
Host basis-prod
    HostName YOUR_EC2_HOST_OR_IP
    User ubuntu
    IdentityFile ~/.ssh/YOUR_KEY.pem
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

`ServerAliveInterval 60` sends a keepalive every 60 seconds; `ServerAliveCountMax 3` tolerates three misses before giving up. Without this, SSH tunnels often **idle out** after a few minutes (see [Gotcha: tunnel idles out by default](#gotcha-tunnel-idles-out-by-default)).

### Terminal 1 (once per session) — start FastAPI on EC2 under `nohup`

```bash
ssh basis-prod
pkill -f uvicorn || true                    # kill any stale process
cd ~/Basis/backend
nohup uv run uvicorn basis.api.main:app --host 127.0.0.1 --port 8000 > /tmp/uvicorn.log 2>&1 &
sleep 3
curl -s http://localhost:8000/health        # verify before exiting
exit                                        # uvicorn keeps running (nohup)
```

### Terminal 2 — SSH tunnel (no output when healthy)

```bash
ssh -L 8000:127.0.0.1:8000 -N basis-prod
```

Leave this terminal open. `-N` means no remote shell — **no output is normal**.

### Terminal 3 — frontend on your Mac

From the root of your local clone:

```bash
cd frontend
npm install          # first time or after package.json changes
npm run dev
```

Open **http://localhost:3000**. `next dev` proxies `/api/*` to `http://localhost:8000`, which the tunnel forwards to EC2.

### Verify from your Mac

```bash
curl -s http://localhost:8000/health
```

Expect JSON. If this fails while `curl` on the EC2 box succeeds, the tunnel is wrong or dead (see [Gotcha: health works on EC2 but not on Mac](#gotcha-health-works-on-ec2-but-not-on-mac-via-tunnel)).

---

## Restart uvicorn after every `git pull` on EC2 (CRITICAL)

The running uvicorn process loads Python modules into memory at startup. A `git pull` updates files on disk but **does not** update the live process. uvicorn keeps serving the routes (and code paths) it had at startup, regardless of the current tree. That remains true even when the pull diff shows **zero** backend files changed — process state can drift from disk in ways a file diff does not show.

**Rule: any time you `git pull` on EC2, restart uvicorn** (no exceptions):

```bash
ssh basis-prod
pkill -f uvicorn
cd ~/Basis/backend
nohup uv run uvicorn basis.api.main:app --host 127.0.0.1 --port 8000 > /tmp/uvicorn.log 2>&1 &
sleep 3
curl -s http://localhost:8000/health   # verify
```

When Phase 7.4 ships (`basis-api.service`), this becomes `sudo systemctl restart basis-api` and can move into a deploy script. Until then, it is manual and easy to forget — a common source of confusing outages.

---

## Stop uvicorn / inspect logs

**Stop uvicorn** (end of session, or before restarting after a pull):

```bash
ssh basis-prod
pkill -f uvicorn
```

**Inspect recent uvicorn output:**

```bash
ssh basis-prod
tail -50 /tmp/uvicorn.log
```

---

## Shutdown order at end of a polish session

Reverse of startup:

1. **Terminal 3:** Ctrl-C (`npm run dev`).
2. **Terminal 2:** Ctrl-C (tunnel).
3. **EC2:** optionally `pkill -f uvicorn` if you want to free port 8000; otherwise uvicorn keeps running under `nohup` until killed.

**systemd timers** on EC2 (`basis-collect.timer`, `basis-backup.timer`, `basis-data-fresh.timer`) keep running regardless.

---

## Gotcha: `-N` tunnel looks frozen

The `-N` tunnel produces **no output** when it is working. That is success, not a hang. Leave the terminal alone.

---

## Gotcha: tunnel idles out by default

SSH’s `ServerAliveInterval` is off by default; idle connections can **drop silently** after a few minutes. Fix it in `~/.ssh/config` on the `basis-prod` host (see [SSH config entry for basis-prod](#one-time-sshconfig-entry-for-basis-prod)): `ServerAliveInterval 60` and `ServerAliveCountMax 3`.

---

## Gotcha: `channel N: open failed: connect failed: Connection refused`

If messages like `channel N: open failed: connect failed: Connection refused` stream in the **tunnel** terminal, the tunnel itself is usually fine — **nothing is listening on port 8000 on EC2** (uvicorn is dead or not started). Restart uvicorn under `nohup` ([Terminal 1](#terminal-1-once-per-session--start-fastapi-on-ec2-under-nohup)).

---

## Gotcha: home IP rotation breaks SSH

If `ssh basis-prod` fails to connect, check your current public IPv4 (`curl -4 ifconfig.me`) and update the **SSH inbound** rule on the **`basis-sg`** security group (AWS Console → EC2 → Security Groups). Prefer a **`/24`** CIDR to your current address; use **`/16`** if your ISP rotates addresses frequently.

---

## Gotcha: running uvicorn serves code from last start, not last pull

Same as [Restart uvicorn after every `git pull` on EC2 (CRITICAL)](#restart-uvicorn-after-every-git-pull-on-ec2-critical). After **any** `git pull` on EC2, restart uvicorn.

---

## Gotcha: health works on EC2 but not on Mac via tunnel

If `/health` returns JSON on the EC2 host but not through `http://localhost:8000` on your Mac, the **tunnel is dead** or something else is bound to Mac port 8000. On your Mac: `lsof -i :8000`. Restart the tunnel: `ssh -L 8000:127.0.0.1:8000 -N basis-prod`.

---

## Known operational debt

- **Phase 7.4 (`basis-api.service`)** — Planned in [basis-deployment-roadmap.md](../basis-deployment-roadmap.md) but **not shipped**. FastAPI is started with **`nohup`** per polish session and must be **restarted manually after every `git pull`** on EC2. Shipping the systemd unit would replace the nohup workflow and reduce stale-process outages.

---

## When to use which path

| Goal | Path |
|------|------|
| UI work against **real** production data | **Polish loop** (this section) |
| Backend changes, collector debugging, migrations, analytics rebuilds, methodology iteration without touching prod | **Fully local** (below) |

---

## Run fully locally (initial setup / offline)

Everything runs on your machine: Docker Postgres, local `uvicorn`, local `next dev`. Use this for backend development, tests, and reproducibility without relying on EC2 or SSH.

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
