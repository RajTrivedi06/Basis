import { Suspense } from "react";
import { ExplainabilityPageClient } from "./ExplainabilityPageClient";

function ExplainabilityFallback() {
  return (
    <div className="page-wide fade-up">
      <div className="eyebrow mb-2.5">ML explainability</div>
      <p className="caption">Loading page…</p>
    </div>
  );
}

export default function ExplainabilityPage() {
  return (
    <Suspense fallback={<ExplainabilityFallback />}>
      <ExplainabilityPageClient />
    </Suspense>
  );
}
