# ML Training Runbook — Mac → S3 → EC2

## What this is for

The operational recipe for (re)training the explainability model (design:
`docs/analysis/ml-explainability-design.md`) and publishing its artifact so the API and
frontend serve it. Training runs on Raj's Mac against the local corpus; the artifact
travels through S3; EC2 only ever serves precomputed results (t3.small — no inference).

## When to retrain

- **A new era boundary is declared** (collector regime change — e.g. the era-D Vast spot fix).
- **A new provider accumulates real history** — first trigger: Azure + GCP once they have
  ~4+ weeks of daily data (they are excluded from the current cycle per design §1
  Amendment 1; update `TRAINED_PROVIDERS` in `basis/ml/features.py` and the §7
  `trained_providers` metadata expectation together).
- **Monthly** otherwise, so the corpus window and served numbers do not go stale.

## Prerequisites

- Local Postgres up: repo-root compose project only (`basis-db-1`, port 5433). Never a
  worktree compose project.
- AWS credentials in the shell for `--upload` (any default-chain source; EC2 uses its IAM
  role, the Mac typically env vars).
- On-disk repo at the commit you intend to stamp into `metadata.code_version` — commit or
  stash local changes first; the artifact records `git rev-parse --short HEAD`.

## Steps

### 1. Refresh the local corpus from the production dump

Follow `docs/03-guides/restore-backup-locally.md` (S3 daily dump → restore → `alembic
current` check). Sanity: row count going up vs last restore; all expected sources present:

```sql
select source, count(*), max(collected_at) from raw_observations group by 1 order by 2 desc;
```

### 2. Train

```bash
cd backend
uv run python run_train.py            # full corpus, default SKU h100_sxm_80gb
```

The run prints: extraction summary → per-fold table → holdout metrics → ANOVA comparison
and gap → sanity battery → SHAP top-20 → host analysis, then writes
`backend/models/explainability_v<schema>_<date>.{json,ubj}`.

### 3. Review the sanity battery — do not skip

The pipeline hard-aborts (no artifact) on: permuted-target holdout R² > 0.05, or the
Director stop thresholds (holdout day-demeaned R² > 0.85 or < 0.2, or a single feature
holding > 50% of gain). An abort is a finding, not an inconvenience — investigate before
rerunning; check duplicate-row and null-map warnings in the log even on success. If a
stop threshold fires, escalate to the Director before publishing anything.

### 4. Publish

```bash
uv run python run_train.py --upload
```

Uploads the versioned JSON + model and updates the `explainability_latest.json` alias in
`s3://basis-backups-rajt-2026/models/`.

### 5. Verify the API picks it up

The endpoint caches for 15 minutes; a freshly restarted process fetches immediately:

```bash
ssh basis-prod
curl -s http://127.0.0.1:8000/api/ml/explainability | head -c 400   # expect metadata JSON, not a 503
```

If it still serves stale data, restart uvicorn from `~/Basis/backend` (never repo root)
— mandatory anyway after any `git pull` on EC2. Then spot-check `/explainability` on the
site renders the new `trained_at`.

## Troubleshooting

- **503 "artifact not found"** — `--upload` didn't run or alias missing; re-run step 4.
- **503 credentials detail on EC2** — IAM role issue; check instance profile.
- **`insufficient days`** — corpus restore incomplete (needs ≥ 20 distinct days); redo step 1.
- **Numbers move a lot between retrains** — check era coverage first (`metadata.era_coverage`
  and per-fold provider mix); a new regime entering the window is the usual cause, and a
  Director flag, not a silent re-publish.
