import { Suspense } from "react";
import { BasisPageClient } from "./BasisPageClient";

function BasisFallback() {
  return (
    <div className="page-wide fade-up">
      <div className="eyebrow mb-2.5">03 · Basis decomposition</div>
      <p className="caption">Loading page…</p>
    </div>
  );
}

export default function BasisPage() {
  return (
    <Suspense fallback={<BasisFallback />}>
      <BasisPageClient />
    </Suspense>
  );
}
