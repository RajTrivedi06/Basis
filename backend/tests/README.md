# Backend tests

The committed database fixture in `fixtures/db/` contains complete date/SKU
groups exported from the local research database: 3,425 linked raw and
canonical rows, 88 aggregate rows, and 27 decomposition rows. It spans six UTC
dates, five SKUs (including `h100_sxm_80gb`), and all four current or historical
providers. The raw payloads are public provider data and were scanned for
secret-like fields before commit.

`fixtures/seed_db.py` is intentionally fail-loud. Given `DATABASE_URL` for a
fresh Postgres database, it runs `alembic upgrade head`, validates the fixture
invariants, and loads all four tables in one transaction. It refuses to seed if
any fixture table already contains rows:

```bash
cd backend
DATABASE_URL=postgresql+asyncpg://basis:basis@localhost:5433/basis_test \
  uv run --project .. python -m tests.fixtures.seed_db
```

Tests marked `slow` scan or recompute against the full configured corpus.
The CI-sized deterministic suite excludes them:

```bash
cd backend
uv run --project .. pytest -m "not slow"
```

The normalization batch regression is destructive and remains skipped unless
`BASIS_ALLOW_DESTRUCTIVE_TESTS=1` is explicitly set. Never opt in while
`DATABASE_URL` points to a database you care about; the test also refuses to
run when `ENVIRONMENT=prod`.
