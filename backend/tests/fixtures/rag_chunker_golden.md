# GPU Basis Study

This fixture describes how Basis treats quoted GPU prices as market evidence rather than executed transactions. It keeps provider, region, commitment, bundle, and collection-era context visible so a reader can distinguish a measured result from an unsupported generalization. The opening section is intentionally substantial enough to stand on its own and establish the document hierarchy used by the golden chunking test. It also gives the tokenizer enough prose to avoid being merged as a tiny section. Basis remains a research study rather than a procurement tool, trading simulator, or transaction benchmark, and that boundary belongs in the retrievable narrative context.

## Long Analysis

P1_START The first long paragraph explains that raw H100 prices vary across providers even before adjustments. A careful comparison retains the exact source, collection timestamp, reported region, commitment type, verification state, and bundled resources. Those fields make the later decomposition auditable because every canonical offer links back to an immutable raw observation. The paragraph repeats the methodological emphasis deliberately: quoted prices are evidence about visible offers, not proof of completed transactions or future availability. P1_END

P2_START The second long paragraph describes conservative normalization. Basis maps clearly documented GPU names, regions, and commitment categories with explicit rules, but it does not invent missing network quality or contractual terms. This restraint preserves the residual instead of explaining it away through assumptions. Each adjustment can be inspected, reproduced, and traced to a source field, while unknown attributes remain unknown. The resulting residual is therefore a market-design question about observable limits rather than a promise that every hidden cause has been discovered. P2_END

P3_START The third long paragraph covers time structure. Collection regimes changed when unauthenticated marketplace results collapsed, when authenticated collection restored inventory, and when bid offers became visible. Era labels expose those shifts to analysis without treating calendar time as a continuous price predictor. Expanding-window validation trains only on earlier UTC days and reserves the final days for untouched evaluation. This ordering matters because repeated hosts and catalog offers would leak identity information under a random row split and produce flattering but misleading accuracy. P3_END

P4_START The fourth long paragraph explains comparison metrics. The gradient-boosted model reports day-demeaned out-of-sample R squared, pooled R squared, log-price error, provider-specific diagnostics, and a same-day comparison to the rule-based ANOVA. Reciprocal evidence from several metrics is more informative than a single headline score. A negative early fold is retained rather than hidden because changing provider composition is part of the observed market. Robustness results for healthy collection eras are reported beside the full-corpus fit so disagreement remains visible. P4_END

P5_START The fifth long paragraph discusses interpretation. Feature importance and SHAP values reveal which observed fields the model uses, but association is not causation. A motherboard label or availability signal can proxy for host identity, platform state, or an omitted commercial attribute. Host fixed effects are analyzed separately to avoid turning the primary model into a machine identifier lookup. The final claim is deliberately bounded: richer observable features can explain some variation, while unobserved reputation, contract language, demand shocks, and service quality may still remain. P5_END

## Tiny Note

TINY_MARKER Era labels are descriptive regime metadata.

## Following Detail

FOLLOWING_START Era D begins when Vast bid offers become visible in the collected corpus. It is not a claim that the entire market changed on one universal date. The label records a specific collection and marketplace regime so analyses can disclose what inventory was observable. Questions about Era D should therefore retrieve both the era definition and the bid-bug investigation, while current numerical claims should prefer live tools over stale prose. This following section is intentionally long enough that the tiny sibling above must merge forward into it without forcing an undersized standalone chunk. FOLLOWING_END

## Table Evidence

Tables must remain atomic because separating a header from its rows destroys meaning. The rows below summarize deliberately small examples, and the surrounding prose ensures this final section is independently useful. A chunker may place prose beside the table, but it must never divide the table between output chunks or detach the alignment row from the header.

| era | collection state | interpretation |
|---|---|---|
| A | pre-cap marketplace results | baseline collection regime |
| B | capped unauthenticated results | missing inventory is a collection artifact |
| C | authenticated results restored | healthy on-demand visibility resumes |
| D | bid endpoint included | spot and on-demand offers are both visible |

TABLE_END The table is followed by enough explanation to keep the section above the minimum token target. Readers should interpret each era as provenance metadata, not as a causal variable or a promise that provider behavior was otherwise stable. The complete table, its heading, and this note belong together for retrieval.
