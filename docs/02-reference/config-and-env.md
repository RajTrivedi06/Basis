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
| `DATABASE_URL` | `postgresql+asyncpg://basis:basis@localhost:5432/basis` | Async SQLAlchemy connection URL |
| `ENVIRONMENT` | `dev` | `dev` / `prod`. Currently unused for anything except logging. |

### Provider API keys (all optional)

| Var | Notes |
|-----|-------|
| `VAST_API_KEY` | Optional; public endpoints work without it but may be rate-limited. Get from [vast.ai](https://vast.ai). |
| `RUNPOD_API_KEY` | Optional; public GraphQL works without it. Get from [runpod.io](https://www.runpod.io/console/user/settings). |
| `LAMBDA_API_KEY` | **Unused** (Lambda Labs dropped — see ADR 0003). Field kept for future re-enablement. |

### AWS (required for AWS Spot collector)

| Var | Notes |
|-----|-------|
| `AWS_ACCESS_KEY_ID` | IAM access key, starts with `AKIA`. |
| `AWS_SECRET_ACCESS_KEY` | IAM secret. Shown only once at creation — store carefully. |
| `AWS_DEFAULT_REGION` | Default `us-east-1`. Not strictly required (collector overrides per call), but good to set. |

**IAM permission needed:** `ec2:DescribeSpotPriceHistory`, typically granted via the `AmazonEC2ReadOnlyAccess` managed policy.

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
