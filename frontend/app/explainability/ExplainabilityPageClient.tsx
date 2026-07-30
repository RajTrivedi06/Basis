"use client";

import { useQuery } from "@tanstack/react-query";
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

  return (
    <div className="page-wide fade-up space-y-10">
      <header className="max-w-[960px]">
        <div className="eyebrow mb-2.5">ML explainability</div>
        <h1 className="text-2xl font-medium text-[var(--ink-hi)] sm:text-3xl">
          Observable-features bound on H100-SXM
        </h1>
        <p className="mt-4 max-w-[68ch] text-sm leading-relaxed text-[var(--ink-mid)]">
          Gradient-boosted trees + SHAP qualify the rule-based residual: how much
          additional variance is explainable from observable features we collect
          but do not use in the four-factor decomposition. This is a bound, not
          proof about unobservables.
        </p>
      </header>

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
