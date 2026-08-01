# Ask Basis model benchmark

Date: 2026-08-01  
Golden set: 37 questions (`backend/evals/questions.yaml`)  
Corpus maximum: 2026-07-29 21:00 UTC

## Method

All candidates ran through the local `/api/ask` JSON endpoint with the primary
heading-aware chunk fixture. The API and verification SQL shared one database;
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
| `deepseek/deepseek-chat` | 50.0% | 35.1% | 42.9% | 100.0% | 52.355 | $0.0392 | 4.09s |
| `moonshotai/kimi-k2.5` | 45.0% | 67.6% | 71.4% | 90.0% | **62.678** | $0.1347 | 12.03s |
| `z-ai/glm-4.5-air` | 65.0% | 32.4% | 28.6% | 95.0% | 54.072 | $0.0344 | 8.38s |

Kimi wins by 8.606 points over GLM and 10.323 over DeepSeek. Its deterministic
accuracy was lower than GLM's, but its much stronger citation and safety scores
won under the approved weighting. The serving default is therefore
`moonshotai/kimi-k2.5`.

Raw scorecards:

The candidate scorecards' regression metadata was normalized after correcting
the runner's unconditional tier-C gate; question answers, verdicts, scores,
usage, and timings are unchanged.

- [`benchmark-deepseek.json`](../../backend/evals/results/benchmark-deepseek.json)
- [`benchmark-kimi-k2.5.json`](../../backend/evals/results/benchmark-kimi-k2.5.json)
- [`benchmark-glm-4.5-air.json`](../../backend/evals/results/benchmark-glm-4.5-air.json)

## Baseline qualification and tripwire

The first benchmark exposed that models elaborated after the mandated refusal
sentence. The system prompt was clarified to require the exact refusal and no
extra text for out-of-scope requests. This is a model-independent contract fix,
not a scoring relaxation. A fresh full Kimi run then scored 73.068 overall, with
all 7 tier-C cases passing and 26 of 37 answers passing numeric citation checks.
That run is committed as `backend/evals/baseline.json` and as
[`winner-kimi-k2.5.json`](../../backend/evals/results/winner-kimi-k2.5.json).

For the regression tripwire, the system prompt was temporarily replaced with
`Always answer 42.`. The tier-C run failed all 7 questions, scored 0.000, and
exited nonzero with `tier c has 7 failure(s)`. After restoring the prompt, the
same tier passed 7 of 7, scored 100.000, and exited zero.

- [`tripwire-broken.json`](../../backend/evals/results/tripwire-broken.json)
- [`tripwire-restored.json`](../../backend/evals/results/tripwire-restored.json)
