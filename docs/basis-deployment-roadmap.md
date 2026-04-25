# Basis — Production Deployment Roadmap (v3 — Final Implementation Plan)

**Status:** Implementation plan, ready to execute
**Author:** Claude (Raj's strategic partner)
**Date:** 2026-04-23
**Domain:** `gpu-basis.xyz` (Namecheap, registered)
**Predecessors:** v1 (proposal, archived), v2 (post-first-review, archived)

---

## What changed from v2

v2 had ~15 issues caught in second-round agent review. v3 fixes all of them. Specifically:

**Code changes now baked into the plan:**

- `aws_spot.py` modified to use boto3's default credential chain (no explicit keys passed)
- `collect_cron.sh` no longer redirects output to a file; output flows to systemd journal
- `data_fresh_check.sh` rewritten in pure bash (no `bc` dependency, handles empty DB)
- `main.py` CORS config moves to `pydantic-settings` instead of `os.environ.get`

**Config changes:**

- `.env.example` updated with all new variables and Lambda Labs key removed
- `docker-compose.yml` keeps existing local password (`basis:basis`) to avoid local-dev breakage; production EC2 uses a separate password via env var
- Apex DNS record changed from CNAME to A record (Vercel's documented apex pattern)
- AWS CLI install moved before backup script in document ordering

**Fresh-start migration:**

- v2's pg_dump-from-Mac step is removed entirely
- EC2 starts with empty Postgres
- `alembic upgrade head` creates schema, timer starts collecting fresh
- No restore-test needed (nothing to restore yet; backup-restore-test happens after first daily backup lands)

**Other fixes:**

- Postgres readiness probe in systemd uses direct `pg_isready` against the port, not `docker compose exec` (which fails before container exists)
- `unzip` and other missing packages added to apt install
- `MemoryMax` added to `basis-api.service`
- CI workflow path filter dropped (so backend-only PRs aren't blocked)
- CORS string split adds `.strip()` to handle whitespace
- Reboot test verifies all four timers/services
- SSH tunnel polish-phase command added explicitly

---

## v3 corrections (applied 2026-04-23 after second-pass agent review)

Sixteen small corrections applied directly to v3 rather than producing a v4. All from second-pass agent review:

- Phase 1.1: clarified asymmetry in collect_cron.sh redirects
- Phase 1.2: aws_spot.py change preserves BotoConfig retry policy; replaces credential guard with session probe instead of removing it
- Phase 1.3: flagged allow_methods tightening as deliberate
- Phase 1.4: kept ENVIRONMENT/VAST_API_KEY/AWS_DEFAULT_REGION in .env.example; dropped phantom TENSORDOCK_API_KEY; flagged lambda_api_key removal in Settings
- Phase 1.5: corrected description of current docker-compose state
- Phase 1.6: added Node version pin via package.json engines field
- Phase 1.7: replaced `rm package-lock.json` recipe with `npm uninstall`
- Phase 1.7b (new): gated next.config.ts rewrite on NODE_ENV === "development"
- Phase 2.5: added Caddy keyring chmod commands and explicit Docker enable
- Phase 4.1: added -q flag to pg_isready probe
- Phase 4.3: narrowed ExecStop to docker compose stop db
- Phase 4.5: clarified catch-up test pass signal (oneshot services show inactive after success)
- Phase 7.2: added CAA preflight check
- Phase 7.4: added www.gpu-basis.xyz to CORS_ORIGINS
- Phase 7.5: added production branch alignment precondition
- Phase 8.1: expanded reboot verification

---

## Constraints and context

- **Domain:** `gpu-basis.xyz` (registered on Namecheap)
- **Budget:** $100 AWS credit, expires 2027-04-17. Real out-of-pocket cost: ~$2 (domain, already paid)
- **Stack:** Python + FastAPI + Postgres (Docker for Postgres only) + Next.js + TypeScript + Tailwind
- **Branch:** `ui-port-v2` (or `main` if merged before deploy)
- **Data approach:** **fresh start on EC2.** No migration of existing 3 days of Mac-collected data. The 30-day evaluation window begins on first successful EC2 collection.

---

## High-level architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          The Internet                                │
└────────┬────────────────────────────────────┬───────────────────────┘
         │                                    │
         ▼                                    ▼
┌──────────────────────┐            ┌──────────────────────────────┐
│  Vercel (frontend)   │            │  AWS EC2 t3.small (backend)  │
│                      │            │                              │
│  gpu-basis.xyz       │  HTTPS API │  api.gpu-basis.xyz           │
│  Next.js production  │ ─────────► │  Caddy → FastAPI (uvicorn)   │
│  build, CDN-served   │            │  Postgres (Docker)           │
│                      │            │  systemd timer → collect job │
│                      │            │  S3 backup (daily pg_dump)   │
│                      │            │  healthchecks.io ping        │
└──────────────────────┘            └──────────────────────────────┘
```

---

## Phase 0 — Pre-work (~30 minutes, do today/tomorrow)

### 0.1 Verify AWS credit

- AWS Console → Billing → Credits → confirm $100 balance, expiration 2027-04-17

### 0.2 Healthchecks.io setup

- Sign up at https://healthchecks.io (free)
- Create three checks:
  - **`basis-collect`**: Schedule type "Cron", value `0 8,20 * * *`, grace period 30 minutes
  - **`basis-backup`**: Schedule type "Cron", value `0 3 * * *`, grace period 1 hour
  - **`basis-data-fresh`**: Schedule type "Simple", period 1 hour, grace period 14 hours (so a single missed collection cycle triggers the alert ~14 hours later, not 26)
- Note all three ping URLs

### 0.3 Namecheap DNS pre-config

You can configure DNS now even before the EC2 instance exists. Just leave the IP as a placeholder you'll update in Phase 5.

In Namecheap → Domain List → `gpu-basis.xyz` → Manage → Advanced DNS, plan these records (don't add yet, you'll add in Phase 5.1 once you have the IP):

- **A record** for `@` → `76.76.21.21` (Vercel's apex IP — verify exact value when adding the domain in Vercel; Vercel's docs may update)
- **A record** for `api` → `<elastic-ip>` (placeholder; real value in Phase 5)
- **CNAME** for `www` → `gpu-basis.xyz`

**Important DNS note:** the apex (`@`) uses a real A record, not a CNAME. CNAMEs at the apex violate RFC 1034 and Namecheap's BasicDNS handles them poorly. Vercel publishes a static IP for apex use; that's the right pattern.

### 0.4 Confirm Vercel account

- Sign up at https://vercel.com if you don't have one
- Connect your GitHub account
- Don't deploy yet — that's Phase 5.5

---

## Phase 1 — Code prep (commit before EC2 setup)

These are repo changes that need to be in `ui-port-v2` (or `main`) before you provision EC2. Make these commits on your Mac, push to remote, then EC2 clones the updated code.

### 1.1 Fix `collect_cron.sh` — remove hardcoded path AND remove file logging

Current state of `backend/collect_cron.sh`:

- Line 8 hardcodes `REPO_DIR="/Users/raaj/Documents/CS/Basis"` — fails on EC2
- Multiple lines redirect output to `$LOG_DIR/collect.log` (some with stderr, some without — the three `uv run` lines use `>> "$LOG_FILE" 2>&1`, the four header `echo` lines use `>> "$LOG_FILE"` for stdout only). The replacement removes all of them so output flows to systemd journal.

Updated `backend/collect_cron.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Find repo root from script location (works on any machine)
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$REPO_DIR/backend"
cd "$BACKEND_DIR"

UV="$HOME/.local/bin/uv"
[ -x "$UV" ] || UV="$(command -v uv)"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] basis-collect starting"

"$UV" run python run_collect.py
"$UV" run python run_normalize.py
"$UV" run python run_analytics.py

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] basis-collect done"

# Ping healthchecks.io on success
if [ -n "${HC_PING_URL:-}" ]; then
    curl -fsS -m 10 --retry 5 -o /dev/null "$HC_PING_URL" || true
fi
```

Key changes:

- `REPO_DIR` resolves from script location, works anywhere
- No `>> "$LOG_FILE" 2>&1` redirects — output flows to stdout/stderr, captured by systemd
- Healthchecks.io ping at end (only on success, since `set -e` aborts on error)

### 1.2 Modify `aws_spot.py` to use default credential chain

Current state: `backend/basis/collectors/aws_spot.py` line ~88 reads `settings.aws_access_key_id` and aborts if missing.

Find the `boto3.client(...)` call inside `_fetch_region_sync`. The current code wraps `region_name` and retry settings in a `BotoConfig` object. Change from:

```python
boto_config = BotoConfig(
    region_name=region,
    retries={"max_attempts": 2, "mode": "standard"},
)
client = boto3.client(
    "ec2",
    aws_access_key_id=settings.aws_access_key_id,
    aws_secret_access_key=settings.aws_secret_access_key,
    config=boto_config,
)
```

To:

```python
boto_config = BotoConfig(
    region_name=region,
    retries={"max_attempts": 2, "mode": "standard"},
)
# boto3 picks up credentials from env vars (local) or IAM role (EC2)
client = boto3.client("ec2", config=boto_config)
```

Keep `config=boto_config` — `region_name` and the retry policy live inside it. Only the two credential kwargs come out.

Replace the early-return guard at the top of `collect()` (currently `if not settings.aws_access_key_id or not settings.aws_secret_access_key: return []`) with a session-level credentials probe so local dev without AWS creds still skips gracefully:

```python
import boto3

if boto3.Session().get_credentials() is None:
    logger.warning("AWS credentials not findable (env, IAM role, or profile) — skipping AWS Spot")
    return []
```

This works on Mac (returns `None` when no creds in env or `~/.aws/`) and on EC2 (returns `Credentials` from instance metadata via the IAM role). It's a behavior-preserving substitute for the old env-var check; without it, any contributor without AWS creds in `.env` would see every region task crash with `NoCredentialsError` instead of the current silent-skip-with-warning.

**On your Mac, this still works:** boto3 reads `AWS_ACCESS_KEY_ID` from your `.env` via the existing settings load.

**On EC2, this works via IAM role:** no keys in `.env`, boto3 reads from instance metadata.

### 1.3 Update `main.py` CORS config

Current state: `backend/basis/api/main.py` lines ~27-35 hardcode `["http://localhost:3000"]`.

Add to `backend/basis/config.py` Settings class:

```python
cors_origins: str = "http://localhost:3000"
```

Update `backend/basis/api/main.py`:

```python
from basis.config import settings

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)
```

**Note:** this change also tightens `allow_methods` from `["*"]` to `["GET"]`. Deliberate — the API is read-only. Don't revert this thinking it was incidental.

Local dev still works (env var unset → default `http://localhost:3000`). EC2 will set `CORS_ORIGINS=http://localhost:3000,https://gpu-basis.xyz,https://www.gpu-basis.xyz` in `.env`.

### 1.4 Update `.env.example`

Current state: includes `LAMBDA_API_KEY=` (dropped per ADR 0003), missing new variables.

Updated `.env.example`:

```bash
# Database
DATABASE_URL=postgresql+asyncpg://basis:basis@localhost:5433/basis
POSTGRES_PASSWORD=basis  # local dev keeps existing volume's password

# Environment
ENVIRONMENT=dev

# AWS Spot collector (local only; EC2 uses IAM role)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1

# CORS (production overrides this on EC2)
CORS_ORIGINS=http://localhost:3000

# Healthchecks.io (production only; leave blank locally)
HC_PING_URL=
HC_BACKUP_PING_URL=
HC_DATA_FRESH_PING_URL=

# Provider API keys
VAST_API_KEY=
RUNPOD_API_KEY=
```

**Important:** `POSTGRES_PASSWORD=basis` is the safe default for local dev. Your existing local Postgres volume was initialized with this password; changing it would break local dev or require destroying the volume. EC2 will set a different `POSTGRES_PASSWORD` since it starts with a fresh volume.

**Notes:**

- `ENVIRONMENT`, `VAST_API_KEY`, and `AWS_DEFAULT_REGION` are kept in the example because all three are referenced in [`backend/basis/config.py`](../backend/basis/config.py) — Settings reads them on load. Removing them from the example would lose the documentation hint even though Settings defaults cover absence at runtime.
- `TENSORDOCK_API_KEY` is **not** in the example: neither `backend/basis/config.py` nor `backend/basis/collectors/tensordock.py` references such a variable. The TensorDock collector hits the public endpoint `https://dashboard.tensordock.com/api/v2/locations` with no auth (collector file header: "Auth: None required"). Adding the env var would be misleading.

**Additional Settings cleanup:** drop the `lambda_api_key: str = ""` field from [`backend/basis/config.py`](../backend/basis/config.py) line ~34. ADR 0003 retired the Lambda Labs collector; the Settings field has been a leftover. Remove it in the same commit that updates `.env.example`.

### 1.5 Update `docker-compose.yml`

Current state: binds Postgres to `0.0.0.0:5433`, no healthcheck, currently uses a hardcoded `POSTGRES_PASSWORD: basis` literal (the postgres image has no default password — the hardcoded literal is what makes the current setup work). The change is from hardcoded literal to env-interpolated default.

Updated `docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: basis
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-basis}
      POSTGRES_DB: basis
    ports:
      - "127.0.0.1:5433:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U basis -d basis"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

The `${POSTGRES_PASSWORD:-basis}` syntax keeps your local dev working with the existing volume even if `POSTGRES_PASSWORD` isn't set in your local `.env`.

**Caveat:** Docker Compose env interpolation reads both `.env` *and* OS environment, with OS env winning. If `docker compose up` fails to connect locally after this change, run `env | grep POSTGRES_PASSWORD` to check for shell-shadowing from another project.

### 1.6 Update CI workflow

Create `.github/workflows/frontend-build.yml`:

```yaml
name: Frontend Build Check

on:
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json
      - working-directory: frontend
        run: npm ci
      - working-directory: frontend
        run: npx tsc --noEmit
      - working-directory: frontend
        run: npm run build
```

No `paths:` filter — workflow runs on every PR to main, including backend-only PRs. The frontend build is fast and the alternative (path-filtered required check) blocks backend PRs from merging.

**Pin Node version on the project side too.** Add an `engines` field to `frontend/package.json` so Vercel's build uses the same Node version as CI:

```json
"engines": {
  "node": "20.x"
}
```

Without this, Vercel may default to a different Node version and produce a build that diverges from the CI smoke test.

### 1.7 Tremor cleanup

Run `npm uninstall` to remove `@tremor/react` and `@tailwindcss/typography` cleanly:

```bash
cd frontend
npm uninstall @tremor/react @tailwindcss/typography
npm run build  # verify build still passes
```

`npm uninstall` updates both `package.json` and `package-lock.json` deterministically without churning unrelated transitive deps. Same end state as a manual remove-and-reinstall, minimal diff, and CI's `npm ci` keeps working.

Commit `package.json` and `package-lock.json` together.

### 1.7b Gate `next.config.ts` rewrite on dev mode only

The current `frontend/next.config.ts` rewrites `/api/*` to `http://localhost:8000` unconditionally. The rewrite is only useful in `next dev` (where the FastAPI backend runs locally on port 8000); on Vercel it would point at unreachable infrastructure. Today's code paths use absolute URLs via `NEXT_PUBLIC_API_URL` so the rewrite never fires in production, but it's a latent footgun for any future `fetch("/api/...")` call.

Update `frontend/next.config.ts` to gate the rewrite on `NODE_ENV`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
```

`next dev` keeps proxying `/api/*` to local FastAPI; `next build` (run by Vercel) emits no rewrite at all.

### 1.8 Set branch protection (after CI workflow merges)

GitHub repo → Settings → Branches → Branch protection rules:

- Branch name pattern: `main`
- Require status checks to pass before merging: ✓
- Required check: `Frontend Build Check / build`

### 1.9 Commit and push all changes

Suggested commit sequence:

```bash
git checkout ui-port-v2  # or main
# (edit each file)
git add backend/collect_cron.sh
git commit -m "fix: collect_cron.sh portable path, drop file logging"
git add backend/basis/collectors/aws_spot.py
git commit -m "fix: aws_spot uses default boto3 credential chain"
git add backend/basis/api/main.py backend/basis/config.py
git commit -m "fix: CORS origins env-driven via pydantic-settings"
git add .env.example
git commit -m "chore: update .env.example, drop Lambda Labs"
git add docker-compose.yml
git commit -m "fix: docker-compose localhost binding + healthcheck + password"
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: remove Tremor and typography plugin (ADR 0005 cleanup)"
git add .github/workflows/frontend-build.yml
git commit -m "ci: add frontend build check on PRs to main"
git push
```

Verify locally: `docker compose down && docker compose up -d --wait && cd backend && uv run python run_collect.py` — should still work end-to-end.

---

## Phase 2 — EC2 provisioning (~1.5 hours)

### 2.1 Set billing alert FIRST (5 minutes)

**Non-negotiable. Do this before launching any instance.**

- AWS Console → Billing → Budgets → Create budget
- Type: Cost budget. Period: Monthly. Amount: $20
- Email alert at 80% and 100% of budget
- Notification: your email

### 2.2 Create IAM role for EC2 (10 minutes)

- AWS Console → IAM → Roles → Create role
- Trusted entity type: AWS service → EC2
- Add inline policy with:
  ```json
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": ["ec2:DescribeSpotPriceHistory"],
        "Resource": "*"
      }
    ]
  }
  ```
- We'll add S3 permissions in Phase 4.1 after creating the bucket
- Role name: `basis-ec2-role`

### 2.3 Launch EC2 instance (15 minutes)

- EC2 Console → Launch instances
- Name: `basis-prod`
- AMI: Ubuntu Server 24.04 LTS (HVM), SSD, 64-bit (x86)
- Instance type: **t3.small**
- Key pair: create new, download `basis-key.pem`, store in password manager + local `~/.ssh/basis-key.pem` with `chmod 400`
- Network settings:
  - VPC: default
  - Auto-assign public IP: enable (we'll replace with Elastic IP)
  - Security group: create new, name `basis-sg`
    - Inbound rule 1: SSH (22), source: My IP
    - Inbound rule 2: HTTP (80), source: Anywhere (0.0.0.0/0)
    - Inbound rule 3: HTTPS (443), source: Anywhere (0.0.0.0/0)
- Storage: 20 GB gp3, encryption: enable
- **Advanced details → IAM instance profile: select `basis-ec2-role`**
- Launch

### 2.4 Allocate Elastic IP (5 minutes)

- EC2 Console → Elastic IPs → Allocate Elastic IP
- Region: same as instance
- Allocate
- Select the new IP → Actions → Associate Elastic IP address → instance: `basis-prod`
- **Save this IP.** You'll need it for DNS, SSH commands, and shutdown.

### 2.5 Initial SSH and system packages (30 minutes)

```bash
# From local
chmod 400 ~/.ssh/basis-key.pem
ssh -i ~/.ssh/basis-key.pem ubuntu@<elastic-ip>

# === On EC2 ===

sudo apt update && sudo apt upgrade -y

# Core packages (note: unzip is needed for AWS CLI install)
sudo apt install -y \
  docker.io docker-compose-v2 git curl unzip \
  postgresql-client-16 \
  build-essential

# Ensure Docker starts on boot (later systemd units depend on docker.service)
sudo systemctl enable --now docker

# Caddy from official repo (NOT in stock Ubuntu)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
# Per Caddy install docs: keyring + sources.list must be world-readable, otherwise apt update fails with permission errors
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
sudo chmod o+r /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy

# AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
unzip awscliv2.zip
sudo ./aws/install
rm -rf awscliv2.zip aws/

# Verify role auth (should not prompt for keys)
aws sts get-caller-identity
# Expect: account number, role ARN ending in basis-ec2-role/i-xxxxx

# Docker group membership
sudo usermod -aG docker ubuntu
exit

# Reconnect for group change
ssh -i ~/.ssh/basis-key.pem ubuntu@<elastic-ip>

# uv
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc
uv --version  # verify
```

### 2.6 Add 2GB swap (5 minutes)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h  # verify swap is active
```

### 2.7 Clone repo and configure environment (15 minutes)

```bash
# On EC2
cd /home/ubuntu
git clone <basis-repo-url>  # use HTTPS or set up a deploy key
cd Basis
git checkout ui-port-v2  # or main if merged

# Create production .env
nano .env
```

Production `.env` contents (fill in real values):

```bash
DATABASE_URL=postgresql+asyncpg://basis:<PROD_PASSWORD>@localhost:5433/basis
POSTGRES_PASSWORD=<PROD_PASSWORD>

# Note: no AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY here.
# boto3 picks up credentials from the IAM role automatically.

CORS_ORIGINS=http://localhost:3000,https://gpu-basis.xyz,https://www.gpu-basis.xyz

HC_PING_URL=https://hc-ping.com/<basis-collect-uuid>
HC_BACKUP_PING_URL=https://hc-ping.com/<basis-backup-uuid>
HC_DATA_FRESH_PING_URL=https://hc-ping.com/<basis-data-fresh-uuid>

RUNPOD_API_KEY=<your-runpod-key>
TENSORDOCK_API_KEY=<your-tensordock-key>
```

**Why `www.gpu-basis.xyz` is in CORS_ORIGINS:** even though www redirects to apex via Vercel's 308, browsers can briefly send `Origin: https://www.gpu-basis.xyz` headers before the redirect resolves. Belt and suspenders — including www avoids transient CORS failures during the redirect window.

**Generate a strong `<PROD_PASSWORD>`:** `openssl rand -base64 24` and use that.

```bash
chmod 600 .env
```

### 2.8 Install Playwright browser (10 minutes)

```bash
cd /home/ubuntu/Basis
uv sync
uv run playwright install --with-deps chromium
```

This downloads ~300MB and installs system libraries. Takes 5-10 minutes on t3.small.

---

## Phase 3 — Database setup (~30 minutes)

### 3.1 Bring up Postgres

```bash
cd /home/ubuntu/Basis
docker compose up -d --wait
docker compose ps  # verify db is "healthy"
```

### 3.2 Run migrations (creates schema)

```bash
cd /home/ubuntu/Basis
uv run alembic upgrade head
```

Verify:

```bash
docker compose exec db psql -U basis -d basis -c "\dt"
# Should show: raw_observations, canonical_offers, daily_aggregates, basis_decomposition
```

### 3.3 First manual collection (verifies end-to-end)

```bash
cd /home/ubuntu/Basis
uv run python run_collect.py
uv run python run_normalize.py
uv run python run_analytics.py

# Verify data
docker compose exec db psql -U basis -d basis -c "SELECT COUNT(*) FROM raw_observations;"
# Expect: ~1,500-1,700 (single run, four providers)
```

If any collector fails:

- AWS Spot fails with credential error → IAM role isn't attached or policy is wrong; verify with `aws sts get-caller-identity`
- RunPod or TensorDock fails → check their API keys in `.env`
- Vast.ai fails → no auth needed; likely network or API change

---

## Phase 4 — Scheduled collection via systemd (~45 minutes)

### 4.1 Create collector service

`/etc/systemd/system/basis-collect.service`:

```ini
[Unit]
Description=Basis collect → normalize → analytics pipeline
After=docker.service network-online.target
Wants=network-online.target
Requires=docker.service

[Service]
Type=oneshot
User=ubuntu
WorkingDirectory=/home/ubuntu/Basis/backend
EnvironmentFile=/home/ubuntu/Basis/.env
# Wait for Postgres to accept connections (no docker exec needed)
ExecStartPre=/usr/bin/timeout 60 bash -c 'until pg_isready -h 127.0.0.1 -p 5433 -q; do sleep 2; done'
ExecStart=/home/ubuntu/Basis/backend/collect_cron.sh
StandardOutput=journal
StandardError=journal
MemoryMax=1800M
```

Key points:

- `pg_isready -h 127.0.0.1 -p 5433 -q` doesn't require the docker container to exist as a callable tool; it just probes the port. Works at first boot before any `docker compose up`. The `-q` flag silences per-attempt output so the journal stays clean — only failures and the eventual success line appear.
- `pg_isready` ships in `postgresql-client-16`, which Phase 2.5 apt-installs. It is **not** a stock Ubuntu command; if Phase 2.5 was skipped, this line will fail with `command not found`.
- `EnvironmentFile=/home/ubuntu/Basis/.env` loads variables for the script (including `HC_PING_URL`)
- `MemoryMax=1800M` prevents OOM-killing Postgres during heavy analytics

### 4.2 Create collector timer

`/etc/systemd/system/basis-collect.timer`:

```ini
[Unit]
Description=Basis collection — twice daily

[Timer]
OnCalendar=*-*-* 08:00:00 UTC
OnCalendar=*-*-* 20:00:00 UTC
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
```

### 4.3 Postgres at boot

The compose `restart: unless-stopped` policy handles Postgres restarts after Docker is running, but doesn't bring up Postgres on a fresh boot. Add a small unit:

`/etc/systemd/system/basis-postgres.service`:

```ini
[Unit]
Description=Basis Postgres (docker compose)
After=docker.service network-online.target
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=true
WorkingDirectory=/home/ubuntu/Basis
ExecStart=/usr/bin/docker compose up -d --wait
ExecStop=/usr/bin/docker compose stop db
User=ubuntu

[Install]
WantedBy=multi-user.target
```

Update `basis-collect.service` to require this:

```ini
[Unit]
After=basis-postgres.service network-online.target
Requires=basis-postgres.service
```

### 4.4 Enable and start

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now basis-postgres.service
sudo systemctl enable --now basis-collect.timer
sudo systemctl list-timers basis-collect.timer
```

### 4.5 Verify catch-up behavior — power-off test

**v2 had this test wrong.** `Persistent=true` catches up missed runs that occurred while the **system was off**, not while the timer was stopped on a running system.

To test correctly:

1. From AWS Console, stop the EC2 instance shortly before the next 08:00 UTC or 20:00 UTC scheduled fire
2. Wait until 5 minutes past the scheduled fire
3. Start the instance
4. SSH back in and run:
   ```bash
   sudo systemctl status basis-collect.service
   journalctl -u basis-collect -n 100 --no-pager
   ```

**How to interpret the result.** `basis-collect.service` is `Type=oneshot`, so after a successful catch-up the unit will usually show `inactive (dead)` in `systemctl status`, **not** `active`. Don't read that as a failure — that's normal for oneshot services after they exit. The pass signals are:

- Recent journal entries showing the collector ran shortly after boot (timestamp in `journalctl -u basis-collect` is within a few minutes of the boot time)
- The `"basis-collect done"` line at the end of the latest run, indicating the script reached the success path before exiting

If the journal has no entries from after boot, `Persistent=true` isn't working — investigate before trusting catch-up.

**Multiple-miss behavior.** If several schedule slots were missed (e.g. the instance was down for 30 hours, missing both the 08:00 and 20:00 fires), systemd performs **one** immediate catch-up activation on boot, not one activation per missed slot. That's the intended design — running two collection cycles back-to-back wouldn't produce useful data anyway. Don't expect to see two journal entries in this case; one is correct.

---

## Phase 5 — Backups (~45 minutes)

### 5.1 Create S3 bucket

- AWS Console → S3 → Create bucket
- Name: `basis-backups-rajt-2026` (or any globally-unique variant)
- Region: same as EC2 (us-east-1)
- Block all public access: yes
- Versioning: enable
- Default encryption: enable (SSE-S3)
- Lifecycle rule: delete after 90 days

### 5.2 Update IAM role with S3 permissions

IAM Console → Roles → `basis-ec2-role` → Add permissions → Create inline policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::basis-backups-rajt-2026/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::basis-backups-rajt-2026"
    }
  ]
}
```

(Substitute your actual bucket name.)

Verify on EC2:

```bash
aws s3 ls s3://basis-backups-rajt-2026/
# Should succeed (empty listing is fine)
```

### 5.3 Backup script

Create `/home/ubuntu/Basis/backend/scripts/backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_DIR"

BUCKET="basis-backups-rajt-2026"  # update to your actual bucket name
TODAY="$(date -u +%Y-%m-%d)"
BACKUP_FILE="/tmp/basis-${TODAY}.sql.gz"

# Dump and compress (note -T to disable TTY allocation)
docker compose exec -T db pg_dump -U basis basis | gzip -9 > "$BACKUP_FILE"

# Upload to S3 (uses IAM role)
aws s3 cp "$BACKUP_FILE" "s3://${BUCKET}/daily/basis-${TODAY}.sql.gz"

# Local cleanup: keep last 7 days
find /tmp -name 'basis-*.sql.gz' -mtime +7 -delete

# Healthchecks.io ping
if [ -n "${HC_BACKUP_PING_URL:-}" ]; then
    curl -fsS -m 10 --retry 5 -o /dev/null "$HC_BACKUP_PING_URL" || true
fi
```

Make executable:

```bash
chmod +x /home/ubuntu/Basis/backend/scripts/backup.sh
```

### 5.4 Backup service and timer

`/etc/systemd/system/basis-backup.service`:

```ini
[Unit]
Description=Basis daily Postgres backup to S3
After=basis-postgres.service
Requires=basis-postgres.service

[Service]
Type=oneshot
User=ubuntu
EnvironmentFile=/home/ubuntu/Basis/.env
ExecStart=/home/ubuntu/Basis/backend/scripts/backup.sh
StandardOutput=journal
StandardError=journal
```

`/etc/systemd/system/basis-backup.timer`:

```ini
[Unit]
Description=Basis daily backup at 03:00 UTC

[Timer]
OnCalendar=*-*-* 03:00:00 UTC
Persistent=true
RandomizedDelaySec=600

[Install]
WantedBy=timers.target
```

Enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now basis-backup.timer
```

### 5.5 Test backup manually

```bash
sudo systemctl start basis-backup.service
journalctl -u basis-backup -n 50 --no-pager
aws s3 ls s3://basis-backups-rajt-2026/daily/
```

You should see one `.sql.gz` file. Restore-test from the cloud backup later this week (when there's actually data worth verifying).

---

## Phase 6 — Data freshness probe (~20 minutes)

### 6.1 Probe script

Create `/home/ubuntu/Basis/backend/scripts/data_fresh_check.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Query age of newest observation in seconds (integer)
LATEST=$(docker compose -f /home/ubuntu/Basis/docker-compose.yml exec -T db \
  psql -U basis -d basis -tAc \
  "SELECT COALESCE(EXTRACT(EPOCH FROM (NOW() - MAX(collected_at)))::bigint, 999999) FROM raw_observations;")

# Strip whitespace
LATEST="${LATEST//[[:space:]]/}"

# If newer than 13 hours, ping healthchecks.io
# If older or DB empty, don't ping — let the hc.io grace period fire the alert
if [ "$LATEST" -lt 46800 ]; then
    if [ -n "${HC_DATA_FRESH_PING_URL:-}" ]; then
        curl -fsS -m 10 --retry 5 -o /dev/null "$HC_DATA_FRESH_PING_URL" || true
    fi
fi
```

Pure bash arithmetic, no `bc` dependency. Empty DB returns 999999, doesn't ping, eventually triggers hc.io alert.

```bash
chmod +x /home/ubuntu/Basis/backend/scripts/data_fresh_check.sh
```

### 6.2 Probe service and timer

`/etc/systemd/system/basis-data-fresh.service`:

```ini
[Unit]
Description=Basis data freshness probe
After=basis-postgres.service
Requires=basis-postgres.service

[Service]
Type=oneshot
User=ubuntu
EnvironmentFile=/home/ubuntu/Basis/.env
ExecStart=/home/ubuntu/Basis/backend/scripts/data_fresh_check.sh
StandardOutput=journal
StandardError=journal
```

`/etc/systemd/system/basis-data-fresh.timer`:

```ini
[Unit]
Description=Basis data freshness check — hourly

[Timer]
OnCalendar=*-*-* *:00:00 UTC
Persistent=true
RandomizedDelaySec=120

[Install]
WantedBy=timers.target
```

Enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now basis-data-fresh.timer
```

This combination (hourly probe + healthchecks.io 14h grace) means: if data goes stale, you get an alert ~14 hours later, not 24 hours later.

---

## Phase 7 — Public deploy (~2 hours; do after polish phase, ~Week 2)

**Recommended timing:** wait 1-2 weeks. Polish UI via SSH tunnel (Phase 8 below). Deploy publicly only when polish is done.

### 7.1 SSH tunnel for polish phase

```bash
# On Mac
ssh -i ~/.ssh/basis-key.pem -L 8000:127.0.0.1:8000 -N ubuntu@<elastic-ip>
```

Leave that running in one terminal. In another:

```bash
cd ~/path/to/Basis/frontend
npm run dev
```

The Next.js dev server proxies `/api/*` to `localhost:8000` (per existing `next.config.ts`), which is now tunneled to EC2's FastAPI. Real production data, fast iteration.

When ready to deploy, kill the tunnel and proceed.

### 7.2 Configure DNS records

In Namecheap → `gpu-basis.xyz` → Advanced DNS, add:

| Type     | Host  | Value           | TTL |
| -------- | ----- | --------------- | --- |
| A Record | `@`   | `76.76.21.21`   | 300 |
| A Record | `api` | `<elastic-ip>`  | 300 |
| CNAME    | `www` | `gpu-basis.xyz` | 300 |

**Verify** the apex value `76.76.21.21` against Vercel's current docs at the time of deploy; they may publish a different IP. When you add the custom domain in Vercel (step 7.5), Vercel surfaces the exact value to use.

DNS propagation: typically 1-24 hours. Check with:

```bash
dig api.gpu-basis.xyz +short
dig gpu-basis.xyz +short
```

**CAA preflight (one-liner before Caddy).** Before Phase 7.3, check whether any CAA records on the apex would block Let's Encrypt from issuing the cert:

```bash
dig CAA gpu-basis.xyz +short
```

If the output is empty, proceed normally — the registrar isn't restricting which CAs can issue. If non-empty, add a `CAA 0 issue "letsencrypt.org"` record at Namecheap **before** restarting Caddy. Otherwise Caddy will silently fail the ACME challenge and `https://api.gpu-basis.xyz/health` won't come up. Namecheap's BasicDNS doesn't add CAA records by default so the check is usually empty, but the one-liner avoids a confusing debug session if it isn't.

### 7.3 Caddy configuration

`/etc/caddy/Caddyfile`:

```
api.gpu-basis.xyz {
    reverse_proxy localhost:8000
    encode gzip
    log {
        output file /var/log/caddy/api-access.log
        format console
    }
}
```

Apply:

```bash
sudo systemctl restart caddy
sudo systemctl status caddy
```

Wait 30-60 seconds for Caddy to obtain the Let's Encrypt cert. Verify:

```bash
curl https://api.gpu-basis.xyz/health
```

If it 404s or times out: check `journalctl -u caddy -n 50` for ACME challenge errors. Most common cause: DNS hasn't propagated yet, or security group doesn't allow port 80.

### 7.4 FastAPI as systemd service

`/etc/systemd/system/basis-api.service`:

```ini
[Unit]
Description=Basis FastAPI backend
After=basis-postgres.service network-online.target
Requires=basis-postgres.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/Basis
EnvironmentFile=/home/ubuntu/Basis/.env
ExecStart=/home/ubuntu/.local/bin/uv run uvicorn basis.api.main:app --host 127.0.0.1 --port 8000
Restart=on-failure
RestartSec=5
MemoryMax=600M
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Note: bound to `127.0.0.1:8000`. Only Caddy talks to it.

Enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now basis-api.service
sudo systemctl status basis-api
curl https://api.gpu-basis.xyz/health  # should return 200
```

### 7.5 Vercel frontend deploy

**Precondition:** before importing the repo into Vercel, confirm that `main` contains the code you want deployed. If you're still on `ui-port-v2` or another branch, merge to `main` first. Vercel's default production branch is `main`; if `main` is stale, the first deploy builds outdated code.

If you specifically want to deploy from a non-`main` branch, override the production branch in Vercel project settings → Git → Production Branch. For our case, deploy from `main` and merge there beforehand.

1. https://vercel.com → Add New → Project → Import the basis repo
2. Framework preset: Next.js
3. Root directory: `frontend/`
4. Build command: default
5. **Environment variables — set BEFORE first deploy:**
   - `NEXT_PUBLIC_API_URL=https://api.gpu-basis.xyz`
   - **Critical:** Next.js inlines `NEXT_PUBLIC_*` at build time. Setting it after first deploy means the bundle hardcodes empty string and all API calls 404. Set first.
6. Deploy
7. After successful deploy: Settings → Domains → Add `gpu-basis.xyz` and `www.gpu-basis.xyz`
8. Vercel will show the exact apex IP needed; verify your `@` A record matches

### 7.6 Disable Vercel preview deployment access

Vercel project → Settings → Deployment Protection → Vercel Authentication → enable for Preview deployments. This means PR previews require login and won't be indexed or accessible publicly.

### 7.7 Verification

- `curl https://api.gpu-basis.xyz/health` → 200
- Browser to `https://gpu-basis.xyz` → dashboard loads
- All five pages render (Findings, Dispersion, Basis, Providers, Methodology)
- Charts populate with real data
- Browser dev tools: API calls go to `https://api.gpu-basis.xyz/api/*` with 200 responses
- HTTPS lock icon present, no mixed-content warnings
- Test on phone — mobile layout doesn't break

---

## Phase 8 — Reboot test + ongoing operations

### 8.1 Full reboot test

After everything is configured:

```bash
sudo reboot
```

Wait 3 minutes, SSH back in:

```bash
docker compose ps                              # Postgres should be healthy
sudo systemctl status basis-postgres.service   # active
sudo systemctl status basis-api.service        # active (after Phase 7)
sudo systemctl status basis-collect.timer      # active, next run scheduled
sudo systemctl status basis-backup.timer       # active
sudo systemctl status basis-data-fresh.timer   # active
sudo systemctl status caddy                    # active (after Phase 7)
sudo systemctl list-timers 'basis-*' --all     # all three timers listed with valid next-fire times
journalctl -b -u basis-postgres -u basis-api -u caddy -n 100 --no-pager
curl http://localhost:8000/health              # 200
curl https://api.gpu-basis.xyz/health          # 200 (after Phase 7)
```

All services should be running without intervention. The boot-scoped `journalctl -b` query catches startup-order issues (e.g. basis-api starting before Postgres is ready) and Caddy ACME problems faster than the per-unit `systemctl status` view alone — those failure modes often look fine in `status` but leave clear errors in the boot log.

### 8.2 Weekly checks (5 minutes/week)

Run on EC2 via SSH:

```bash
docker compose exec db psql -U basis -d basis -c "
SELECT COUNT(DISTINCT DATE(collected_at AT TIME ZONE 'UTC')) AS days,
       MIN(collected_at) AS first,
       MAX(collected_at) AS latest,
       COUNT(*) AS total_obs
FROM raw_observations;"
```

- `days` should grow by 1 each day, gap-free
- `total_obs` should grow by ~3,000-3,500 per day (two runs × ~1,600 obs)

Check S3:

```bash
aws s3 ls s3://basis-backups-rajt-2026/daily/ | tail -7
```

- Should show 7 backups, one per day

Check email:

- No alerts from healthchecks.io = everything firing on schedule

### 8.3 Mid-May milestone (~30 days of data)

- Update `findings.md` with stabilized residual numbers
- Update landing page table with the new range
- Commit, push to main → Vercel auto-deploys frontend, backend keeps running

### 8.4 Watch items

- New `skipped_unknown_gpu` cases (check journal: `journalctl -u basis-collect | grep skipped`) — fix in `canonicalize.py` as they appear
- AWS billing alert — should never fire ($20 budget, expected ~$20-21/month including Elastic IP)
- Provider API shape changes — surface as parse errors in the journal

---

## Phase 9 — Shutdown checklist (end of evaluation, ~3 months out)

In order:

1. Final pg_dump archived locally:
   ```bash
   ssh -i ~/.ssh/basis-key.pem ubuntu@<ip> 'docker compose -f /home/ubuntu/Basis/docker-compose.yml exec -T db pg_dump -U basis basis' | gzip > basis-final-shutdown.sql.gz
   ```
2. Disable timers on EC2:
   ```bash
   sudo systemctl disable --now basis-collect.timer basis-backup.timer basis-data-fresh.timer
   ```
3. Terminate EC2 instance (AWS Console → EC2 → Instances → Terminate)
4. Verify EBS volume deleted (auto on termination by default)
5. **Release Elastic IP** ← most-forgotten step; $3.60/month if forgotten
6. Empty and delete S3 bucket
7. Delete IAM role `basis-ec2-role`
8. Pause/delete healthchecks.io checks
9. Vercel: leave (free tier) or remove project
10. Domain: ~$10-15 renewal next year — keep or let lapse
11. Final billing check the day after — confirm no ongoing AWS usage

---

## Cost summary

| Item                    | Monthly      | 3-month total                |
| ----------------------- | ------------ | ---------------------------- |
| EC2 t3.small            | ~$15         | ~$45                         |
| EBS 20 GB gp3           | ~$1.60       | ~$5                          |
| Elastic IP              | ~$3.60       | ~$11                         |
| S3 backups              | <$0.10       | <$0.30                       |
| Vercel                  | $0           | $0                           |
| Caddy + Let's Encrypt   | $0           | $0                           |
| healthchecks.io         | $0           | $0                           |
| Domain `gpu-basis.xyz`  | ~$0.17 equiv | ~$2 (already paid)           |
| **AWS credit consumed** |              | **~$61 of $100**             |
| **Out of pocket**       |              | **$0 (domain already paid)** |

Buffer: ~$39 credit remaining = ~2 more months if evaluation extends.

---

## Implementation order summary

**This week (before weekend):**

- Phase 0: AWS credit check, healthchecks.io setup
- Phase 1: All code changes committed and pushed (1.1 through 1.9)
- Verify locally that everything still works end-to-end

**Saturday morning (~3 hours):**

- Phase 2: EC2 provisioning, IAM role, instance launch, Elastic IP, system setup, swap, repo clone, Playwright
- Phase 3: Postgres up, alembic migrations, first manual collection

**Saturday afternoon (~2 hours):**

- Phase 4: systemd collector service + timer, postgres-on-boot service, power-off catch-up test (or skip and trust later)
- Phase 5: S3 bucket, IAM policy update, backup script + timer, manual backup test
- Phase 6: data freshness probe + timer

**Sunday (~30 min):**

- Phase 8.1: full reboot test
- Then leave it alone for 1-2 weeks

**Week 2 (~2 hours, when polish is done):**

- Phase 7: DNS, Caddy, FastAPI systemd, Vercel deploy, public verification

**Total active work: ~6 hours weekend + ~2 hours week 2.**

---

## Values you'll need during implementation

Note these as you go — they appear repeatedly:

1. **Elastic IP** — known after Phase 2.4
2. **S3 bucket name** — pick during Phase 5.1, must be globally unique
3. **Three healthchecks.io UUIDs** — known after Phase 0.2
4. **Production POSTGRES_PASSWORD** — `openssl rand -base64 24` during Phase 2.7
5. **Provider API keys** — already in your local `.env`

---

## What's no longer in this plan (vs v2)

For completeness, these v2 items are intentionally removed in v3:

- **pg_dump migration from Mac to EC2** — replaced by fresh start
- **Restore-test step** — moved implicitly to "test backup manually" in Phase 5.5; full restore-test happens later when there's meaningful data
- **`ALTER USER basis WITH PASSWORD`** workaround — not needed since EC2 starts with a fresh volume
- **Two parallel collectors comparison** — not needed since Mac stops collecting before EC2 starts
- **`pg_dump --clean --if-exists` recipe** — not needed since no migration

---

## Outstanding optional items

Not blocking deploy. Can be added any time:

- **Rate limiting on public API** — explicitly skipped per your call
- **Backend pytest CI job** — could parallel the frontend build check; v3 doesn't add it
- **`logrotate` for caddy access log** — `/var/log/caddy/api-access.log` will grow unbounded; one-line logrotate config eventually
- **Type III variance attribution** — methodology nice-to-have from your TASKS doc
- **Country code normalization fix** — your TASKS doc flags this; one-file change
