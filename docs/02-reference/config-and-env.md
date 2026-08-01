# Config & Environment

## What this file is for

Every environment variable, where `.env` lives, how config is loaded, and what defaults apply.

## When to read/use this

- Setting up `.env` on a new machine.
- Debugging "why is my config empty?"
- Adding a new config value.

---

## `.env` location

**Repo root:** `/Users/raaj/Documents/CS/Basis/.env`

The path is resolved in `backend/basis/config.py` relative to the config file itself, so it works whether you run commands from `backend/` or the repo root:

```python
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
_ENV_FILE = _REPO_ROOT / ".env"
```

If `.env` is missing, `pydantic-settings` falls back to actual shell env vars, then to the defaults shown below.

---

## Variables

### Core

| Var | Default | Description |
|-----|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://basis:basis@localhost:5433/basis` | Async SQLAlchemy connection URL |
| `POSTGRES_PASSWORD` | `basis` | Postgres password used by `docker-compose.yml` (`${POSTGRES_PASSWORD:-basis}`). Local dev keeps `basis`; production EC2 sets a strong random value. Read by Docker Compose, not a `Settings` field. |
| `ENVIRONMENT` | `dev` | `dev` / `prod`. Currently unused for anything except logging. |

### Provider API keys

| Var | Notes |
|-----|-------|
| `VAST_API_KEY` | **Effectively required** for Vast.ai since 2026-06-23. Unauthenticated requests return only 64 cheapest-first offers. Free key at [cloud.vast.ai](https://cloud.vast.ai/) → Account → API Keys. Collector sends `Authorization: Bearer`. |
| `RUNPOD_API_KEY` | Optional; public GraphQL works without it. Get from [runpod.io](https://www.runpod.io/console/user/settings). |

Previously this section was labeled "all optional" — that is no longer true for Vast.

### AWS (required for AWS Spot collector)

| Var | Notes |
|-----|-------|
| `AWS_ACCESS_KEY_ID` | IAM access key, starts with `AKIA`. |
| `AWS_SECRET_ACCESS_KEY` | IAM secret. Shown only once at creation — store carefully. |
| `AWS_DEFAULT_REGION` | Default `us-east-1`. Not strictly required (collector overrides per call), but good to set. |

**IAM permission needed:** `ec2:DescribeSpotPriceHistory`, typically granted via the `AmazonEC2ReadOnlyAccess` managed policy.

### Healthchecks.io (production only)

These are read directly by the shell scripts (`collect_cron.sh`, the backup/freshness jobs), not by `Settings` — `config.py` uses `extra="ignore"`, so they live in `.env` but are not pydantic fields. Leave them blank locally; the scripts no-op when unset.

| Var | Notes |
|-----|-------|
| `HC_PING_URL` | Ping URL hit after a successful collection run in `collect_cron.sh`. |
| `HC_BACKUP_PING_URL` | Ping URL for the database backup job. |
| `HC_DATA_FRESH_PING_URL` | Ping URL for the data-freshness check. |
| `HC_VOLUME_PING_URL` | Ping URL for the per-provider collection-volume check (`check_collection_volume.py`). Success ping on healthy volumes; `/fail` suffix on collapse. |

### AI layer (Ask Basis — Stage 4)

All optional: each degrades gracefully when unset (endpoint 503 "not configured" for the
serving/embedding keys; tracing silently off for Langfuse). Spend caps are set
provider-side BEFORE first use (design `ask-basis-design.md` §8).

| Var | Notes |
|-----|-------|
| `OPENROUTER_API_KEY` | Serves `/api/ask` answers, the model benchmark, and the tier-b eval judge (`anthropic/claude-haiku-4.5` via OpenRouter). Provider-side spend cap $15/mo. |
| `OPENROUTER_MODEL` | Serving model. Default: benchmark winner (`moonshotai/kimi-k2.5`, see `docs/analysis/ask-basis-model-benchmark.md`). |
| `OPENAI_API_KEY` | Embeddings only (`text-embedding-3-small`, 1536-dim) — index time (`run_index.py`) and query time. Account spend limit $5. |
| `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` | Tracing (retrieval, assembly, model, tools). Both required together; free tier. |
| `LANGFUSE_BASE_URL` | `https://us.cloud.langfuse.com` for US-region accounts; default is the EU host. |
| `ASK_BASIS_DISABLED` | Kill switch: `1` → `/api/ask` returns 503 before any retrieval or model work. |

### Frontend

Frontend has its own `.env.local` inside `frontend/`:

| Var | Default | Description |
|-----|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend base URL |

---

## How config is loaded

- Python: `pydantic-settings` via `basis.config.settings`. Reads from `.env`, then shell env. Extra keys in `.env` are ignored (`extra="ignore"`).
- Frontend: Next.js built-in `.env.local` loader. `NEXT_PUBLIC_*` variables are exposed to the browser.

## `.env.example`

Committed to the repo with blank values and comments. Clone this on setup:

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env.local
```

## What NOT to commit

- `.env` — secrets.
- `.env.local` (frontend) — in `.gitignore`.
- Any file with IAM keys, API tokens, or DB passwords.

## Adding a new config value

1. Add the field to `Settings` in `backend/basis/config.py` with a sensible default (usually `""` for optional keys).
2. Add a commented line to `.env.example`.
3. Document it in this file (the table above).
4. Reference via `settings.your_new_key` — do not call `os.environ` directly.
