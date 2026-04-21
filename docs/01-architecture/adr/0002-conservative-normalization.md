# ADR 0002: Normalization stays rule-based and conservative

## Status

Accepted (2026-04-20)

## Context

Basis measures how fungible GPU compute is across providers. The headline output is the **residual variance** left over after accounting for observable factors. Any normalization we apply shrinks that residual.

There are two philosophical axes:

1. **Rule-based vs ML.** We could train a model to predict "what should this offer cost" given its features, then regress residuals out. Or we could use explicit lookup tables and conditionals.
2. **Aggressive vs conservative.** We could normalize away every plausible driver of variance (bundle composition, time-of-day, reliability tier, etc.) or only the ones with obvious, documented definitions.

## Decision

**Rule-based, conservative.**
- GPU names, regions, commitment types, and bundles are normalized via explicit lookup tables and conditionals in `backend/basis/normalization/`.
- When an input doesn't match the table, we **skip and log** — we do not guess.
- We only normalize factors that are clearly observable and documented.

## Options Considered

### Option A — Rule-based, conservative (chosen)

**Pros:**
- Auditable. Every transformation can be inspected and tested.
- Preserves the residual variance finding. If the residual is large, it's because reality is messy, not because we modeled poorly.
- Easy to extend (add a row to the table).
- Reproducible across time without retraining.

**Cons:**
- Manual effort to keep mapping tables up to date.
- Doesn't capture continuous factors (e.g., reliability score as a price adjuster).

### Option B — Rule-based, aggressive

Normalize for every plausible driver, including reliability tiers, verification status, interconnect type.

**Pros:**
- Cleaner residual.

**Cons:**
- Each additional factor shrinks the residual. The thesis becomes self-fulfilling — "after controlling for everything, there's not much left."
- Definitions drift between providers (e.g., "verified" on Vast.ai ≠ "secure" on RunPod).

### Option C — ML-based

Train a regression model (e.g., GBM on canonical features) that predicts price per GPU-hour. Residuals are the basis.

**Pros:**
- Captures nonlinearities and interactions.
- Less manual work as new providers come online.

**Cons:**
- Not interpretable. "The model says 30% of variance is residual" is not a publishable finding.
- Requires retraining as the market shifts.
- Obscures the distinction between "unexplained by our features" and "explained but we don't know how."
- Runs counter to the project's positioning (a study, not a predictor).

## Consequences

**Positive:**
- The residual variance is defensible as a basis risk measure.
- New contributors can read the mapping tables and immediately understand what's normalized.
- Unit tests can cover every normalization rule.

**Negative:**
- New GPU variants require a mapping-table update or they're skipped.
- Tables will grow as providers add SKUs.
- Some plausible price drivers (reliability, interconnect) are left in the residual rather than attributed.

**Neutral:**
- The residual is a mix of "genuinely idiosyncratic" and "factors we didn't model" — this is honest positioning for the writeup.

## Links

- Code: `backend/basis/normalization/canonicalize.py`, `commitment.py`, `region.py`, `bundle.py`
- Planning doc: `Basis_Project_Proposal.md` (the thesis depends on residual interpretability)
