# ADR 0006: The ML/research layer reads `raw_payload` directly, read-only

## Status

Accepted (2026-07-24)

## Context

The v3 research layer needs per-offer features that the canonical schema does
not carry: Vast payloads hold ~95 stable top-level keys (`reliability2`,
`verification`, `num_gpus`, `gpu_ram`, `cpu_cores_effective`, `inet_down`,
`inet_up`, `disk_bw`, `machine_id`, `host_id`, …) present at ~100% in samples,
while `canonical_offers` deliberately keeps only the fields every provider can
answer. Feature extraction therefore needs access to `raw_observations.raw_payload`.

Two prior commitments constrain the design. ADR-0002: normalization stays
rule-based and conservative — no ML anywhere in the measurement pipeline, no
new canonical columns that only one provider can populate. And the repo-wide
invariant that `raw_observations` is immutable, append-only.

## Decision

**The ML/research layer may read `raw_observations.raw_payload` directly,
READ-ONLY, joining through the existing `canonical_offers.raw_observation_id`
foreign key. The normalization and measurement pipeline is unchanged.**

Concretely:

- ML feature extraction SELECTs from `canonical_offers` joined to
  `raw_observations` and pulls provider-specific keys out of `raw_payload`
  at analysis time. It never writes to either table.
- No provider-specific feature columns are added to `canonical_offers`; the
  canonical schema remains the set of fields every provider can answer.
- ADR-0002 is untouched: nothing ML-derived feeds back into normalization,
  canonicalization, aggregates, or the residual decomposition. The residual
  the study reports is still produced by the rule-based pipeline alone.

## Options Considered

### Option A — Promote ML features into `canonical_offers` columns

**Pros:** one query surface; features become typed and indexed.

**Cons:** pollutes the canonical schema with columns that are 100% NULL for
every provider but Vast (the audit already shows bundle columns 100% NULL for
aws_spot/runpod); every new feature is a migration; blurs the line ADR-0002
draws around what "canonical" means. Rejected.

### Option B — Read `raw_payload` directly via the canonical→raw FK (chosen)

**Pros:** zero schema change; features are provider-specific by nature and
stay labeled as such; the FK join is already indexed
(`ix_canonical_raw_obs_id`, migration `b7f3a9c2d1e4`); precedent exists — the
provenance explain endpoints (`/api/raw-observation/{id}` and `/explain`,
ADR-0004) already read raw payloads read-only at request time.

**Cons:** JSONB key access is unvalidated at the schema level — a provider
changing its payload shape breaks feature extraction silently; queries are
heavier than column reads. Both are acceptable for a research layer that is
explicitly downstream of measurement.

### Option C — Materialize a separate feature table

Premature: adds write-path surface and a sync problem before any ML result
justifies it. Can be revisited if extraction cost becomes real; nothing in
Option B precludes it.

## Consequences

**Positive:**

- The measurement pipeline and its interpretability claim are structurally
  isolated from the ML layer; deleting the ML layer touches no canonical code.
- Vast's rich payload (~95 keys, including stable `machine_id`/`host_id`)
  becomes usable for host-level features without schema churn.

**Negative (stated honestly):**

- ML results will be **Vast-feature-rich and provider-asymmetric**.
  Cross-provider features are limited to what canonical carries: region,
  commitment type, provider, price — plus bundle fields where present
  (100% NULL for aws_spot and runpod). Any model trained on payload features
  is largely a model of the Vast marketplace, and published results must say
  so.
- Payload-shape drift by a provider breaks feature extraction at read time;
  there is no schema contract. Mitigation is presence-rate checks in the
  extraction code, not schema enforcement.

**Neutral:**

- `raw_observations` immutability is unaffected — this ADR grants read
  access only.

## Links

- [ADR 0002 — conservative normalization](0002-conservative-normalization.md) (unchanged by this decision)
- [ADR 0004 — normalization attribution](0004-normalization-attribution.md) (read-only raw-payload precedent)
- Audit basis: `temp-doc/v3-readiness-audit.md` §4 (payload key presence rates, NULL percentages)
- Index: `ix_canonical_raw_obs_id` — `backend/alembic/versions/b7f3a9c2d1e4_add_canonical_raw_obs_id_index.py`
