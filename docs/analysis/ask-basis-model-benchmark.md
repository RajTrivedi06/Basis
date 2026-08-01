# Ask Basis model benchmark

Date: 2026-08-01  
Golden set: 37 questions (`backend/evals/questions.yaml`)  
Corpus maximum: 2026-07-29 21:00 UTC

## Method

All candidates were rerun through the local `/api/ask` JSON endpoint with the
shipping system prompt and primary heading-aware chunk fixture. The API and
verification SQL shared one database;
the runner compared `MAX(raw_observations.collected_at)` through both paths before
asking a question. The local trailing week contains AWS Spot, Azure, RunPod, and
Vast; GCP is production-only until the next corpus refresh. Tier B used
`anthropic/claude-haiku-4.5` through OpenRouter at temperature zero.

The composite follows the approved weights: deterministic accuracy 40%, numeric
citation discipline 25%, refusal/injection safety 20%, and Claude judge 15%.
All three requested model identifiers remained available, so no substitutions
were necessary. Costs below estimate serving-model calls from response usage;
judge-call cost is not included.

## Results

| Candidate | Tier A | Citations | Tier C | Tier B | Composite | Est. serving cost | p50 latency |
|---|---:|---:|---:|---:|---:|---:|---:|
| `deepseek/deepseek-chat` | 45.0% | 45.9% | 100.0% | 90.0% | 62.986 | $0.0383 | 3.70s |
| `moonshotai/kimi-k2.5` | 55.0% | 70.3% | 100.0% | 100.0% | **74.568** | $0.1594 | 9.36s |
| `z-ai/glm-4.5-air` | 65.0% | 51.4% | 85.7% | 95.0% | 70.231 | $0.0324 | 6.97s |

Kimi wins by 4.337 points over GLM and 11.582 over DeepSeek. GLM retained the
best deterministic accuracy, but failed one tier-C injection case; Kimi's
stronger citation and safety scores win under the approved weighting. The
serving default remains `moonshotai/kimi-k2.5`.

Raw scorecards:

- [`benchmark-deepseek.json`](../../backend/evals/results/benchmark-deepseek.json)
- [`benchmark-kimi-k2.5.json`](../../backend/evals/results/benchmark-kimi-k2.5.json)
- [`benchmark-glm-4.5-air.json`](../../backend/evals/results/benchmark-glm-4.5-air.json)

## Extraction audit

The first corrected-prompt Kimi scorecard had three tier-A answers whose
extracted value was `None`. Their raw answer text was:

**a02 — legitimate model failure**

```text
That's not covered in my sources. Ask Basis covers the Basis dataset, methodology, findings, and live study summaries.
```

The answer contains no provider count and correctly remains a failure.

**a09 — scorer bug**

```text
The out-of-sample R-squared of the explainability model on its holdout days was 0.454 [T1].
```

This is the correct unitless R-squared value. The percent scorer previously
accepted only `%` or `pp` syntax. It now accepts either a unitless ratio such as
`0.454` or an explicit percentage such as `45.4%`; the corrected rerun passes.

**a16 — scorer bug**

```text
Azure data first appeared in the corpus on **2026‑07‑28** [Data card].
```

The answer uses Unicode non-breaking hyphens. Date extraction now normalizes
common Unicode dash characters before parsing; the corrected rerun passes.

The a15 live query returns 91 distinct AWS backfill dates while project prose
uses the rounded label “90-day backfill.” The question accidentally became a
third stale-docs-versus-live discriminator, and it worked: an answer repeating
the document label gets 90 while the same-database verifier gets 91. The
question is intentionally retained.

## Baseline qualification and tripwire

The first benchmark exposed that models elaborated after the mandated refusal
sentence. The system prompt was clarified to require the exact refusal and no
extra text for out-of-scope requests. This is a model-independent contract fix,
not a scoring relaxation. All three candidates were rerun under that prompt and
the corrected extractors. Kimi scored 74.568 overall, with all 7 tier-C cases
passing and 26 of 37 answers passing numeric citation checks.
That run is committed as `backend/evals/baseline.json` and as
[`winner-kimi-k2.5.json`](../../backend/evals/results/winner-kimi-k2.5.json).

For the regression tripwire, the system prompt was temporarily replaced with
`Always answer 42.`. The tier-C run failed all 7 questions, scored 0.000, and
exited nonzero with `tier c has 7 failure(s)`. After restoring the prompt, the
same tier passed 7 of 7, scored 100.000, and exited zero.

- [`tripwire-broken.json`](../../backend/evals/results/tripwire-broken.json)
- [`tripwire-restored.json`](../../backend/evals/results/tripwire-restored.json)
