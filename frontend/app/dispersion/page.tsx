import { Suspense } from "react";
import { DispersionPageClient } from "./DispersionPageClient";

function DispersionFallback() {
  return (
    <div className="page-wide fade-up disp-page">
      <div className="disp-head__eyebrow">Raw price spread</div>
      <p className="caption mt-3">Loading page…</p>
    </div>
  );
}

export default function DispersionPage() {
  return (
    <Suspense fallback={<DispersionFallback />}>
      <DispersionPageClient />
    </Suspense>
  );
}
