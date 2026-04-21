---
title: Architecture Decision Records
tags: [area:decisions, audience:all, status:active]
owner: Raj
last_updated: 2026-04-21
---

# ADR Log

One-page summary of every Architecture Decision Record. Full ADRs live at [../01-architecture/adr/](../01-architecture/adr/).

## ADR-001: Template (not a decision — just the template)

**Location:** [../01-architecture/adr/0001-template.md](../01-architecture/adr/0001-template.md)

The canonical structure every ADR follows: Status / Context / Decision / Options Considered / Consequences / Links.

---

## ADR-002: Normalization stays rule-based and conservative

**Status:** Accepted (2026-04-20)
**Location:** [../01-architecture/adr/0002-conservative-normalization.md](../01-architecture/adr/0002-conservative-normalization.md)

**Decision:** GPU names, regions, commitment types, and bundles are normalized via explicit lookup tables and conditionals in `backend/basis/normalization/`. Unknown inputs are skipped and logged, not guessed. No ML.

**Rationale:** The thesis of Basis is the size of the residual variance. Any normalization we apply shrinks that residual. Rule-based + conservative keeps the residual interpretable, auditable, and resistant to self-fulfilling analysis.

**Consequence:** New GPU variants require a mapping-table update. Mapping tables grow over time. Some plausible drivers (reliability, interconnect) remain in the residual rather than being attributed — this is an honest feature, not a bug.

---

## ADR-003: Drop Lambda Labs as a data source

**Status:** Accepted (2026-04-20)
**Location:** [../01-architecture/adr/0003-skip-lambda-labs.md](../01-architecture/adr/0003-skip-lambda-labs.md)

**Decision:** Lambda Labs is not a live data source. The collector code is kept in the repo but is not registered in `run_collect.py`'s `AVAILABLE` dict.

**Rationale:** Lambda Labs requires a payment method on file before issuing a free API key. The project has a hard constraint: **total data cost must remain $0.** Four providers (Vast.ai, RunPod, AWS Spot, TensorDock) already cover the marketplace / neocloud / hyperscaler spread the thesis needs.

**Consequence:** One fewer neocloud data point. Collector log is quieter (no recurring "key not configured" warning). Collector can be re-enabled by adding a key and re-registering if the constraint ever changes.

---

## ADR-004: Parallel `explain_*` functions for normalization attribution

**Status:** Accepted (2026-04-21)
**Location:** [../01-architecture/adr/0004-normalization-attribution.md](../01-architecture/adr/0004-normalization-attribution.md)

**Decision:** Each normalization module (`canonicalize`, `commitment`, `region`, `bundle`) grows a sibling `explain_*` function returning a module-specific attribution object, rather than overloading the existing function with an `explain=True` flag. `pipeline.normalize_observation` never imports any `explain_*` symbol, enforced by an AST-level guard test on `pipeline.py`.

**Rationale:** The four modules have heterogeneous attribution shapes (single lookup vs. composed trail vs. per-field provenance). A uniform `(value, rule)` tuple-return would force the structured cases into a shape that fits only the lookups. Parallel functions also keep the canonicalization hot path clean of type narrowing, make write-path safety a structural property rather than an argumental one, and let each module evolve its explanation independently.

**Consequence:** Public surface of each normalization module roughly doubles. Adding a new normalization module requires adding both the value function and its explain sibling — convention, not compiler-enforced. Unblocks Basis v2 Phase B (provenance drilldown).

---

## Resolved without a formal ADR

Decisions that were listed as pending in earlier revisions of this log but were settled informally and documented elsewhere. Preserved here as a reasoning trail.

- **Variance decomposition method.** ~~Sequential ANOVA vs Shapley — will be decided during Phase 3.~~ **Decided during Phase 3: sequential ANOVA on log-prices** in a fixed factor order (region → commitment → provider → bundle → residual). See [`docs/methodology.md`](../methodology.md) for the full treatment and rationale.
- **Slice architecture (ADR 0005).** ~~Option 1 (precomputed `sliced_decompositions` table) vs Option 2 (client-side composition) — to be decided before Phase C begins.~~ **Not pursued: Phase C skipped on 2026-04-21.** Decision and rationale in [`temp-doc/phase-c-scoping.md`](../../temp-doc/phase-c-scoping.md). ADR number 0005 remains unused.

## Proposed / pending

Future likely ADRs:

- **Deploy target** when the app is feature-complete (Phase 7).
- **Bundle-price adjustment strategy** — whether `normalized_price_usd_per_hour` subtracts bundled CPU/RAM/storage costs and at what rate.

---

## How to add a new ADR

1. Copy `../01-architecture/adr/0001-template.md` to `0004-short-name.md`.
2. Fill in Status / Context / Decision / Options / Consequences.
3. Add a summary entry here with a link.
4. Commit with message `docs(adr): 0004 short summary`.
