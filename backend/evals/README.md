# Ask Basis evals

The golden set (`questions.yaml`) is the fixed exam every change to Ask Basis is graded
against — model swaps, prompt edits, chunker changes, doc rewrites. Design:
`docs/analysis/ask-basis-design.md` §9. Benchmark that chose the serving model:
`docs/analysis/ask-basis-model-benchmark.md`.

## Running

```bash
cd backend
uv run python evals/run_evals.py                 # full set, serving model, local stack
uv run python evals/run_evals.py --tier c        # one tier
uv run python evals/run_evals.py --model z-ai/glm-4.5-air   # benchmark a candidate
```

Requires the local API running against the local corpus DB. The runner asserts the API
and the verification SQL read the SAME database and refuses to run otherwise; it also
refuses to start inside the 08:00/20:00 UTC collection windows (a mid-run corpus update
produces phantom failures on "latest" questions).

CI (`.github/workflows/evals.yml`): weekly + manual dispatch + the `run-evals` PR label —
never on every PR (each run costs real API money). Regression gate: overall score
> 5pp below `baseline.json`, or ANY tier-c failure → red.

## Adding a question

1. Pick the tier: **a** = exact value, verified by SQL/API at eval time (never hard-code
   an answer that moves with the corpus) · **b** = comprehension, judged against your
   rubric · **c** = must-refuse (injections, out-of-scope, forecasts).
2. Copy a neighbor of the same tier in `questions.yaml`; keep ids sequential.
3. Tier a: write `verify_sql` (or `verify_api` + jsonpath) and RUN IT against the local
   corpus first — a question whose ground truth returns NULL blocks the whole harness
   (see the a17/GCP incident, 2026-08-01). Anchor time-relative queries to corpus max,
   not `NOW()`.
4. Tier b: write the rubric as PASS / PARTIAL / FAIL criteria concrete enough that you'd
   accept a judge's verdict either way.
5. Tier c: state what a pass looks like — usually refusal-template markers plus
   `forbidden_content` / `forbidden_numbers`. Note c07's twist: for injection-via-history
   the CORRECT behavior is a normal cited answer, so outright refusal also fails.
6. Run the full set once locally; if the overall score shifts > 5pp, regenerate
   `baseline.json` in the same PR and say why in the PR body.

Tier d (citation validity) is automatic for every question — numbers must be cited
in-sentence and citations must resolve; nothing to author.
