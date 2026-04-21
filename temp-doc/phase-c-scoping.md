# Phase C — Scoping One-Pager

**Status:** Draft for decision (2026-04-21)
**Purpose:** Decide whether Phase C (slice interactivity) is worth building, or whether Phases A + B + D cover the same ground without the architectural cost.

## The question

The original v2 proposal included Phase C — a filter UI that lets a user narrow by commitment type, region, provider, or verification tier, and see the residual for that subset. The review that shaped Revision 2 flagged this as the phase most at risk of forcing an analytics-layer decision prematurely. Revision 2 gated Phase C behind ADR 0005 rather than removing it.

With Phases A and B now shipped, the cost of *not* deciding Phase C is that it keeps occupying a slot in the roadmap, consumes attention during every planning pass, and is the only phase whose architecture is still open. The question is whether the feature earns that slot.

## What A + B already cover

**Phase A (fungibility matrix)** lets a user sort all 85 SKUs by residual %, sample size, or median price. It answers "which GPUs are fungible" at the SKU grain. Implicit slicing: the matrix rows *are* slices, one per SKU.

**Phase B (provenance drilldown)** lets a user click into any decomposition and see the 66 canonical offers that produced it, with every factor value visible including UNKNOWN. Implicit slicing: the user can eyeball the table and see, e.g., "most of these are on-demand; the spot subset looks cheaper," without a filter chip.

Between the two, a user who wants to understand the structure of any SKU's price dispersion has tools — they're just not interactive filters. They're sort + scan.

## What Phase C would add

Interactive filters would answer questions the matrix + drilldown can't cleanly express:

1. **Cross-SKU questions at a specific slice.** "What does the residual look like for on-demand H100s only, across all SKUs?" The matrix shows per-SKU residuals that mix commitment types; filtering by commitment would produce a different fungibility matrix.
2. **Region-specific residuals.** "Is US-East fungibility different from EU fungibility?" Currently invisible — regions are one of the observable factors that get attributed away, so their per-region residual isn't surfaced anywhere.
3. **Provider-excluded residuals.** "What happens to the residual if we drop Vast.ai?" This would test whether marketplace dynamics are driving the headline finding, which is a real analytical question raised implicitly in `findings.md`.

These are real questions. Whether they're *load-bearing* — whether the portfolio is weaker without the ability to answer them interactively — is the decision.

## The case for building Phase C

- Question 3 above is genuinely hard to answer without Phase C, and it's the most analytically interesting of the three. Showing that the residual survives dropping the marketplace provider would strengthen the finding; showing that it doesn't would qualify it. Either outcome is a stronger claim than the current one.
- A filter UI is a natural affordance. A reviewer opening the dashboard expects one. Its absence reads as "read-only report," its presence reads as "analytical tool."
- Option 2 (client-side composition over existing `basis_decomposition` rows) ships in 2–3 days, preserves the API boundary, and adds zero backend infrastructure. Low cost.

## The case against building Phase C

- Questions 1 and 2 are answerable from the existing data via ad-hoc SQL or a notebook — they don't require a dashboard feature. If a future writeup needs them, add them to the writeup, not the UI.
- Phase D (rolling stability) will naturally include a SKU picker and probably a commitment-type toggle. That covers ~50% of Phase C's value for free.
- Option 2 shipped means the slice UI is constrained to whatever `basis_decomposition` already stores — which is `(date, gpu_sku)`. Filtering by commitment or region requires decomposition rows that don't exist yet, meaning Option 2 is actually narrower than the original pitch suggested. The honest Option 2 is "filter matrix by SKU characteristics," not "filter residuals by commitment."
- Option 1 (precomputed `sliced_decompositions` table) solves the narrowness but costs a new table, a new analytics step, a migration, and ~5 days of work. The combinatorial axes it precomputes become a commitment that's hard to walk back.
- The dashboard already tells a coherent story with A + B. Adding C risks diluting the narrative focus — "here's the finding, here's the audit trail, here's how it changes over time" is a stronger arc than "here's the finding, here's the audit trail, here's a filter UI that doesn't show much more than the matrix, and here's how it changes over time."

## Recommendation

**Skip Phase C. Move directly to Phase D when data is sufficient.**

The honest read is:

- Question 1 (cross-SKU slice residual) is nice-to-have, not load-bearing.
- Question 2 (regional residual) is a good candidate for a one-off analytical writeup, not a dashboard feature.
- Question 3 (provider-excluded residual) is the strongest case but it's also a one-off analytical question — the answer is either "residual survives" or "residual doesn't survive," and once it's known, the filter becomes redundant. Better to compute it once, write it up, and cite the result in `findings.md`.

Phase D's rolling view will include SKU filtering and commitment toggling natively. It gives the dashboard the interactivity Phase C would have added, earned by data rather than by architecture.

## If we build it anyway

If this recommendation is rejected, the approach that preserves the most optionality is:

1. Draft ADR 0005 naming Option 2 as the decision, with an explicit scope limit: "filters operate on existing `basis_decomposition` rows; no new precomputation."
2. Accept that the filter UI's expressiveness is constrained by the decomposition grain, and design the UX to make that constraint honest rather than hidden.
3. Ship in 2–3 days, reassess after Phase D whether Option 1 is worth revisiting.

This is the minimum-regret path if the decision goes the other way.

## Dropped from the v2 roadmap if Phase C skipped

- ADR 0005 (slice architecture) — no longer needed.
- The `POST /api/slice` endpoint (never built, never will be).
- The "benchmarkability verdict" label was already deferred to post-Phase-D; this remains unchanged.
- `temp-doc/basis-v2-proposal-r2.md` needs a Revision 3 note or a retroactive update to reflect the skip.

## Open question for the decider

Is there a user or a portfolio moment that specifically requires Phase C to exist? If yes, build it (Option 2, scoped tight). If no, the answer is skip.

## Links

- [v2 proposal (Revision 2)](basis-v2-proposal-r2.md)
- [docs/project-status.md](../docs/project-status.md)
- [docs/findings.md](../docs/findings.md) — where provider-excluded residual analysis would live if pursued as a one-off writeup

## Decision

**Decided 2026-04-21: Skip Phase C.** Phases A + B + D cover the intended narrative arc; interactive slicing adds cost without load-bearing value. Questions 1–3 will be answered via one-off writeups in `findings.md` if and when they become material.
