import { Suspense } from "react";
import { AskPageClient } from "./AskPageClient";

function AskFallback() {
  return (
    <div className="page-wide fade-up">
      <div className="eyebrow mb-2.5">Ask Basis</div>
      <p className="caption">Loading…</p>
    </div>
  );
}

export default function AskPage() {
  return (
    <Suspense fallback={<AskFallback />}>
      <AskPageClient />
    </Suspense>
  );
}
