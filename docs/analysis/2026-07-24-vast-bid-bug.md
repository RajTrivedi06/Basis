---
title: Vast bid/spot collection bug — root cause and fix
tags: [area:analysis, audience:all, status:active]
owner: Raj
last_updated: 2026-07-25
---

# Vast bid/spot collection bug — root cause and fix (2026-07-24/25)

**Symptom:** all 315,685 Vast rows ever persisted carry `commitment_type_reported = 'on_demand'` — zero `spot` rows in the entire corpus — despite the collector running a dedicated `type=bid` query since day one. Surfaced by the [exclude-Vast investigation](2026-07-24-exclude-vast-collapse.md) (§5).

## Root cause — both suspected mechanisms, compounding

**1. The payload's `is_bid` field is always `false`.** The collector derived commitment from `offer.get("is_bid")` (`vast.py:216-218` pre-fix). But `/bundles/` responses set `is_bid: false` on every offer of *both* queries. Evidence:

- Database: all 315,685 stored payloads — `raw_payload->>'is_bid'` = `false`, JSON type boolean, no other value ever observed:

```
 is_bid_val | count
------------+--------
 false      | 315685
```

- Live API probe (2026-07-25, authenticated): on-demand query 2,432 offers, bid query 1,679 offers — `is_bid` distribution `{'False': 2432}` and `{'False': 1679}` respectively. The field does not encode the offer's commitment product in bundles-search results.

**2. Cross-query dedup discarded the bid price series for dual-listed machines.** `_fetch_offers` deduplicated by offer `id` across both queries, on-demand first. But a machine listed by both queries returns *different prices per query* — the fixed on-demand price vs the current interruptible bid price. Live example (offer 9107072, same probe):

```
dph_total:  on-demand=0.5030   bid=0.4817
dph_base:   on-demand=0.5013   bid=0.4800
```

At probe time 1,027 of 1,679 bid offers were dual-listed → their interruptible prices were silently dropped every run. The remaining 652 bid-only offers *were* persisted — with genuine bid prices — but labeled `on_demand` (because `is_bid` is false), polluting the on-demand price distribution.

## Consequences for the corpus (pre-fix, 2026-04-16 → 2026-07-24)

- The commitment factor is constant (`on_demand`) within Vast — ~75% of the corpus — so the sequential-ANOVA commitment step could never attribute any Vast price variance. Decompositions are not *wrong* (the offers and prices are real), but interruptible pricing was invisible to the study.
- An unknown share of historical Vast rows (bid-only listings at collection time) carry interruptible prices mislabeled as on-demand.
- **Historical rows are not recoverable with confidence.** The only candidate discriminator, `dph_base == min_bid`, matches 113,965 rows (36%) — well above any plausible bid share (currently ~21% of a run is bid-only) — so it over-matches on-demand offers and would mislabel history if applied. Per ADR-0002 (explicit rules only, no guessing), no retro-labeling is applied. `raw_observations` stays as collected (immutable regardless).

## Fix (shipped, collector-only)

`backend/basis/collectors/vast.py`:

1. Commitment type now comes from **which query returned the offer**: `type=on-demand` → `on_demand`, `type=bid` → `spot`. The payload's `is_bid` is no longer consulted.
2. **No cross-query dedup.** A dual-listed machine yields two observations — its on-demand price and its bid price — which is correct: they are different commitment products. Dedup still applies within a single query.
3. Provenance: `provider_metadata.query_type` (`"on-demand"` / `"bid"`) records the originating query on every new row, since the raw payload cannot answer this.
4. `_parse_offer` takes the commitment as a parameter (default `on_demand` for fixture-driven tests that parse offers without query context).

Normalization needs no change: `commitment.py` already maps reported `"spot"` → canonical `spot`. The per-provider volume alert is unaffected (it fires only when a run drops below 30% of the rolling median; this change *raises* Vast volume ~33%).

Regression test: `tests/test_collectors.py::test_vast_bid_offers_labeled_spot_and_not_cross_deduped` — mocks both queries, asserts a dual-listed machine produces both observations with correct labels/prices, a bid-only offer is labeled `spot`, and payloads keep their untouched `is_bid: false`.

## Proof (live run, 2026-07-25, dry — no DB write)

```
total observations: 4124
commitment_type_reported: {'on_demand': 2445, 'spot': 1679}
provider_metadata.query_type: {'on-demand': 2445, 'bid': 1679}
dual-listed machines this run: 1006
example offer 44921058: [('on_demand', 0.0233), ('spot', 0.0119)]
```

Persisted Vast volume rises from ~3,100 to ~4,100 rows/run (the formerly-discarded dual-listed bid prices).

## Follow-ups (not done here)

- **Analytics effect starts at fix deployment:** from the first post-deploy collection, Vast gains commitment-type variation, so the commitment factor can begin absorbing variance that previously landed in provider/residual. Any before/after comparison of decompositions must treat the deploy date as a regime boundary. (EC2 deploy is a Stage 5 window item — nothing deployed there in Stage 1.)
- Era-D boundary date to be recorded in `findings.md`/`methodology.md` at the Stage-5 narrative rewrite.
- `docs/02-reference/data-sources.md` still documents `is_bid` as the commitment discriminator for Vast — its Vast section needs a correction pass (flagged, not silently edited; outside this task's file list).
- Backfill of `spot` labels for historical rows: rejected (see above). If Vast ever exposes an authoritative per-offer commitment flag, revisit.

## Era D — fix deployed to production (2026-07-26)

The fix reached production on **2026-07-26 ~02:50 UTC** (EC2 pulled main `de20acb`, uvicorn restarted per the standing rule). The first scheduled collection with the fix ran **2026-07-26 08:00 UTC** and persisted Vast spot rows for the first time:

```
 commitment_type_reported | count
--------------------------+-------
 on_demand                |  2428
 spot                     |  1677
```

**Vast spot offers are present from the 2026-07-26 08:00 UTC run onward. All decomposition series have a regime boundary here (era D):** from this date, the commitment factor can absorb Vast price variance it structurally could not see before, and Vast per-run volume steps up ~+1,700 rows. Any before/after comparison across 2026-07-26 must account for both.
