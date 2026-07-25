---
title: Architecture Decision Records
tags: [area:decisions, audience:all, status:active]
owner: Raj
last_updated: 2026-07-24
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

**Consequence:** One fewer neocloud data point. Collector log is quieter (no recurring "key not configured" warning). Collector can be re-enabled by adding a key and re-registering if the constraint ever changes. **Update (2026-07-13):** TensorDock is also parked (public feed empty); **3 active collectors** remain.

---

## ADR-004: Parallel `explain_*` functions for normalization attribution

**Status:** Accepted (2026-04-21)
**Location:** [../01-architecture/adr/0004-normalization-attribution.md](../01-architecture/adr/0004-normalization-attribution.md)

**Decision:** Each normalization module (`canonicalize`, `commitment`, `region`, `bundle`) grows a sibling `explain_*` function returning a module-specific attribution object, rather than overloading the existing function with an `explain=True` flag. `pipeline.normalize_observation` never imports any `explain_*` symbol, enforced by an AST-level guard test on `pipeline.py`.

**Rationale:** The four modules have heterogeneous attribution shapes (single lookup vs. composed trail vs. per-field provenance). A uniform `(value, rule)` tuple-return would force the structured cases into a shape that fits only the lookups. Parallel functions also keep the canonicalization hot path clean of type narrowing, make write-path safety a structural property rather than an argumental one, and let each module evolve its explanation independently.

**Consequence:** Public surface of each normalization module roughly doubles. Adding a new normalization module requires adding both the value function and its explain sibling — convention, not compiler-enforced. Unblocks Basis v2 Phase B (provenance drilldown).

**Status note:** Shipped — the `explain_*` siblings live at `canonicalize.py:243`, `commitment.py:64`, `region.py:183`, and `bundle.py:139`, with the AST-level guard test on `pipeline.py` in place.

---

## ADR-005: Residual-first UI and hand-rolled SVG charts

**Status:** Accepted 2026-04-21, implemented on main 2026-05-16
**Location:** [../01-architecture/adr/0005-residual-first-ui.md](../01-architecture/adr/0005-residual-first-ui.md)

**Decision:** Drop `@tremor/react` entirely. Every chart in the v2 frontend is hand-rolled SVG, styled via Tailwind and CSS variables defined in `globals.css`. Residual color (`--residual`, amber `#f59e0b`) is enforced by a single token used nowhere else. `@tailwindcss/typography` is also dropped; Methodology is hand-styled.

**Rationale:** The thesis of Basis is the *size* of the residual. Chart primitives must visually foreground it — a donut or equal-weight bar contradicts the finding. Libraries make residual-first discipline leaky (anyone can borrow amber from a palette) and their donut defaults are the exact wrong shape. Five chart primitives (`DecompBar`, `DispersionFan`, `DeviationBar`, `HeatCell`, `Sparkline`) cover every visualization in scope; library overhead is not justified at this size.

**Consequence:** More SVG code to write/maintain than the v1 Tremor stack. Accessibility (ARIA, focus, non-color signals) is manual. Reversible but not cheap — if interactions ever get complex (brushing, linked-view selection), revisit.

---

## ADR-006: The ML/research layer reads `raw_payload` directly, read-only

**Status:** Accepted (2026-07-24)
**Location:** [../01-architecture/adr/0006-ml-layer-raw-payload-access.md](../01-architecture/adr/0006-ml-layer-raw-payload-access.md)

**Decision:** The v3 ML/research layer may read `raw_observations.raw_payload` READ-ONLY, joining through `canonical_offers.raw_observation_id`, for feature extraction. No provider-specific feature columns are added to `canonical_offers`, and nothing ML-derived feeds back into normalization or the residual decomposition — ADR-0002 is untouched.

**Rationale:** The useful features (reliability, verification, host identity, bandwidths) are provider-specific by nature, not canonical; the provenance explain endpoints (ADR-0004) already established read-only raw-payload access; the canonical→raw FK join is indexed.

**Consequence (stated honestly):** ML results are Vast-feature-rich and provider-asymmetric — cross-provider features are limited to region, commitment type, and provider. Payload-shape drift breaks extraction at read time; mitigated by presence-rate checks, not schema.

---

## Resolved without a formal ADR

Decisions that were listed as pending in earlier revisions of this log but were settled informally and documented elsewhere. Preserved here as a reasoning trail.

- **Variance decomposition method.** ~~Sequential ANOVA vs Shapley — will be decided during Phase 3.~~ **Decided during Phase 3: sequential ANOVA on log-prices** in a fixed factor order (region → commitment → provider → bundle → residual). See [`docs/methodology.md`](../methodology.md) for the full treatment and rationale.
- **Slice architecture.** ~~Option 1 (precomputed `sliced_decompositions` table) vs Option 2 (client-side composition) — to be decided before Phase C begins.~~ **Not pursued: Phase C skipped on 2026-04-21.** Decision and rationale in [`temp-doc/phase-c-scoping.md`](../../temp-doc/phase-c-scoping.md). (The ADR-0005 slot previously held for this decision has been repurposed for the residual-first UI decision above.)

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
