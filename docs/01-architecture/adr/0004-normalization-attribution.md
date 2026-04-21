# ADR 0004: Parallel `explain_*` functions for normalization attribution

## Status

Accepted (2026-04-21)

## Context

Basis v2 Phase B ships a provenance drilldown whose final layer is an `/api/raw-observation/{id}/explain` endpoint — a route that returns the decision trail behind each canonical value. Today the four normalization modules (`canonicalize.py`, `commitment.py`, `region.py`, `bundle.py`) return canonical values only; the attributions that produced them are implicit in the code. Exposing attributions requires a new mechanism.

Two constraints apply.

First, attribution is **read-path only**. The write path in `pipeline.normalize_observation` must remain a pure value-producing pass: raw observation in, canonical offer out. If attribution logic can accidentally run during that write — even as a no-op side effect — future refactors risk corrupting canonical data in ways the tests wouldn't catch.

Second, the four modules have **heterogeneous attribution shapes**. `canonicalize_gpu` and `canonicalize_commitment` each apply a single lookup table — their attribution is effectively "which key matched." `normalize_region` branches on source and composes multiple internal lookups into a structured result — its attribution is a trail. `extract_bundle` pulls several fields from provider metadata with source-specific logic — its attribution is per-field provenance. Whatever mechanism we choose has to fit all four without forcing the structured cases into a shape that fits only the lookups.

## Decision

**Add attribution via parallel `explain_*` functions per module, and commit to keeping those functions out of the canonicalization write path.**

Each normalization module grows a sibling function — `explain_canonicalize_gpu`, `explain_canonicalize_commitment`, `explain_normalize_region`, `explain_extract_bundle` — that returns a module-specific attribution object. The existing value-returning function is unchanged. `pipeline.normalize_observation` never imports or calls any `explain_*` symbol; that invariant is enforced by an AST-level guard test in `backend/tests/test_normalization.py` which parses `pipeline.py` and fails if any `Name`, `Attribute`, or `ImportFrom` node references an identifier starting with `explain_`. The new `/api/raw-observation/{id}/explain` route is the only caller of the explain functions.

The write-path safety commitment is part of the decision, not a consequence of it. The import-level guard is the contract: if a future change tries to route attribution logic through the pipeline, the guard test fails before the change can merge.

## Options Considered

### Option A — `explain=True` flag on the existing function, returning `(value, rule_applied)` tuples

**Pros:**
- Single entry point per module; call sites migrate rather than fork.
- Value-returning and attribution-returning code stay in lockstep because they are literally the same function body.

**Cons:**
- Forces heterogeneous attribution into a uniform `(value, rule)` shape. Region and bundle don't fit naturally — region's attribution is a trail across multiple lookups, bundle's is per-field provenance. Both would collapse into string concatenations or nested dicts that are effectively dataclasses in a trench coat.
- Every call site sees a type split. `pipeline.normalize_observation` calls these four functions on every observation in the hot path; paying a type-narrowing tax on a flag that is always `False` there is pure overhead.
- Semantically overloads one symbol: "same function, different return shape based on flag" is a pattern that ages poorly in Python and invites subtle bugs at module boundaries.
- Write-path safety becomes an invariant about *which argument value* is passed, not *which function is called*. That is weaker — any code path that plumbs an external boolean down to the pipeline could flip it accidentally.

### Option B — Parallel `explain_*` functions (chosen)

**Pros:**
- **Heterogeneity preserved.** Each module declares its own attribution shape and evolves it independently. When region grows a new branch or bundle adds a field, the explanation object changes in one place without rippling through a shared convention. This property is the least-reversible point: any mechanism that locks a shared shape across the four modules precludes it. Leading the reasoning.
- **Hot path stays clean.** `pipeline.normalize_observation` imports only the value-returning functions. No conditional return shape, no type narrowing, no flag default to drift.
- **No semantic overloading.** Returning values and returning reasoning are different operations; different function names make that structural rather than argumental.
- **Write-path safety is structural.** The guarantee is "pipeline never references any `explain_*` identifier," which an AST walk over `pipeline.py` asserts. That is stronger than asserting "pipeline never passes `explain=True`," and stronger than a grep-based check which would false-negative on indirect access (`getattr`, `importlib`, star re-exports).

**Cons:**
- Doubles the public surface of each normalization module. Acceptable at a four-module surface; would be painful at larger scale.
- Duplicates some selection logic between the value function and its explainer if the implementations aren't factored carefully. Mitigation: the lookup tables themselves remain single source of truth; only the wrapper that chooses an entry is per-function.

## Consequences

**Positive:**
- Each explanation type can grow to match its module's complexity without amending this ADR. The ADR records the *convention* and the *safety invariant*; the *types* are implementation, designed alongside the code.
- The write-path safety invariant is enforced by a trivial static check (import inspection) rather than runtime assertions that could be bypassed under refactor.
- The attribution layer can be removed cleanly in the future — delete the four explain functions and one API route — without touching canonicalization logic or the pipeline.

**Negative:**
- Adding a future normalization module means remembering to add both the value function and its explain sibling. Convention, not compiler-enforced.
- Developers reading a normalization module see roughly twice as many public functions. The `explain_` prefix carries the cognitive load.

**Neutral:**
- The shape of each attribution return type is deliberately not specified in this ADR. It is an implementation decision, reviewed via PR alongside the code that introduces it.

## Links

- Related proposal: [`temp-doc/basis-v2-proposal-r2.md`](../../../temp-doc/basis-v2-proposal-r2.md) (Phase B)
- Related ADRs: [ADR 0002 — conservative normalization](0002-conservative-normalization.md) (the rule-based commitment that this attribution surfaces)
- Code pointers (value-returning functions today; `explain_*` siblings to be added):
  - `backend/basis/normalization/canonicalize.py`
  - `backend/basis/normalization/commitment.py`
  - `backend/basis/normalization/region.py`
  - `backend/basis/normalization/bundle.py`
  - `backend/basis/normalization/pipeline.py` — must not import any `explain_*` symbol
- Guard test location: `backend/tests/test_normalization.py` — AST-level check that `pipeline.py` contains no reference to any `explain_*` identifier (`Name`, `Attribute`, or `ImportFrom` nodes)
