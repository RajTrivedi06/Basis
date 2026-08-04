import { Suspense } from "react";
import { ExplainabilityPageClient } from "./ExplainabilityPageClient";

function ExplainabilityFallback() {
  return (
    <div className="page-wide fade-up expl-page">
      <div className="expl-head__eyebrow">05 · Explainability</div>
      <p className="caption mt-3">Loading page…</p>
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
