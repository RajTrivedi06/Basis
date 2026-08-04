import { Suspense } from "react";
import { BasisPageClient } from "./BasisPageClient";

function BasisFallback() {
  return (
    <div className="page-wide fade-up settle-page">
      <div className="settle-head__eyebrow">03 · Variance settlement</div>
      <p className="caption mt-3">Loading page…</p>
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
