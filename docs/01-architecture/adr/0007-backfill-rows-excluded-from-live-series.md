# ADR-0007: Backfill rows are excluded from the live market series

**Status:** Accepted (Director-ruled, 2026-08-01)
**Context:** Stage 5 truth patch; production AWS spot-history backfill (PR #24, executed 2026-07-30).

## Decision

`daily_aggregates` and `basis_decomposition` (and the API's on-demand recompute path) are
computed **only from cron-collected rows** — rows whose `raw_observations.provider_metadata`
carries a truthy `backfill` flag are excluded from analytics inputs. The live market series
is thereby *defined* as a same-mechanism, twice-daily cron sample.

The ML training corpus, by contrast, **keeps** backfill rows (they exist precisely to give
the model price history), with the `backfill` flag surfaced as non-feature metadata per the
ML design's era amendment. This asymmetry is deliberate: the model wants maximum history;
the public series wants population continuity.

## Evidence that forced the decision

The 90-day AWS backfill inserts rows with historical timestamps. At the backfill's coverage
boundary its extra density ends: H100-SXM days ≤ 2026-07-29 carried ~57 AWS rows/day
(≈30 cron + ≈27 backfill) while later days carried ~30 (cron only). Fresh cron collections
were verified flat throughout (per-region counts identical daily; no dark regions). Pooled
into the decomposition, this population discontinuity produced an apparent marketplace
residual decline that was partly a **collection-composition artifact masquerading as a
market change** — the same failure class as the 2026-06 Vast-cap incident, caught before
publication by the same verification culture (see the dated addendum in
`docs/analysis/2026-07-24-exclude-vast-collapse.md`).

The related monitoring fix (#38 — backfill timestamps polluting the collection-volume
baseline) shares this root cause: backfill rows violating a cron-sample assumption.

## Operational incident recorded at adoption (2026-08-02)

The production analytics rerun that adopted this ADR surfaced latent index corruption
from the Stage 5 pgvector image swap: moving `postgres:16-alpine` → `pgvector/pgvector:pg16`
crosses **musl → glibc, which changes text collation order and silently invalidates
B-tree indexes on text columns**. The corruption was latent (reads worked; the reboot test
passed) until heavy delete/insert churn touched a poisoned page. Containment: the
pipeline's single-end-commit design rolled the transaction back fully; `REINDEX DATABASE`
was run on production AND the local DB (same image transition); a post-fix `amcheck` pass
verified all 13 B-tree indexes clean.

**Standing procedure: any Postgres image change that can alter the libc/collation version
MUST be followed by `REINDEX DATABASE` before the next write-heavy job.** The step exists
because of collation versioning, not superstition — do not "optimize" it away.

**Backups unaffected:** the daily S3 dumps are logical `pg_dump` output (SQL, no index
pages), hence collation-agnostic; additionally the last pre-swap dump (2026-08-01 03:02 UTC)
predates the incident entirely and remains a clean restore point.

## Consequences

- Analytics rerun required after adoption; the discontinuity flattens (before/after series
  recorded in the Stage 5 report).
- Any future backfill (longer AWS history, a new provider's history) inherits this rule
  automatically via the flag.
- Reviewers asking "why don't the site's numbers include the backfill?" are pointed here:
  the series answers "what does the market look like, sampled the same way every day?" —
  not "what is every observation we possess?"
