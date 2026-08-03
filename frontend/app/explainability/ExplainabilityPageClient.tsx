"use client";

import { useQuery } from "@tanstack/react-query";
import { ShowMeHow } from "@/components/disclosure/TwoLayer";
import { GlossaryTerm } from "@/components/glossary/GlossaryTerm";
import { getMlExplainability } from "@/lib/mlExplainability";
import {
  ExplainabilityContent,
  ExplainabilityEmptyState,
  ExplainabilityLoadingState,
} from "@/components/ml/ExplainabilityContent";

export function ExplainabilityPageClient() {
  const query = useQuery({
    queryKey: ["ml-explainability"],
    queryFn: getMlExplainability,
  });

  // A6: the SKU in the headline and every date on this page come from the
  // artifact. Nothing here is retyped when the model is retrained.
  const sku = query.data?.metadata.sku;

  return (
    <div className="page-wide fade-up">
      <div className="int-head">
        <div className="int-head__eyebrow">
          <span className="num">05</span>
          <span>A bound, not proof about unobservables</span>
        </div>
        <h1 className="int-head__title">
          Observable-features bound{sku ? " on " : ""}
          {sku ? <em className="mono text-[0.62em] not-italic">{sku}</em> : null}
        </h1>
        <p className="int-head__lede">
          A gradient-boosted model tests how much of the leftover price
          variation can be recovered from richer features we already collect but
          do not use in the four-factor decomposition. It establishes an upper
          bound, not a causal explanation.
        </p>

        <div className="mt-6 max-w-[68ch]">
          <ShowMeHow label="Show me how the bound is tested">
            <p>
              The four-factor decomposition is fitted and scored on the same
              days, so its explained share flatters itself. The gradient-boosted
              model is scored on days it never saw — a held-out window — which
              is the honest comparison and generally the harder one.
            </p>
            <p>
              Read the two numbers as a pair. If the richer model, tested
              out-of-sample, still cannot reach what four simple factors claimed
              in-sample, then the missing variation is not sitting in features
              we merely forgot to use. That is what makes it a bound: it caps
              how much of the leftover is recoverable from what sellers
              disclose, and says nothing about attributes nobody publishes.
            </p>
          </ShowMeHow>
        </div>
      </div>

      {query.isLoading ? (
        <ExplainabilityLoadingState />
      ) : query.data ? (
        <ExplainabilityContent artifact={query.data} />
      ) : (
        <ExplainabilityEmptyState />
      )}
    </div>
  );
}
