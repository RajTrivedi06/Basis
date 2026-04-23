import { Suspense } from "react";
import { DispersionPageClient } from "./DispersionPageClient";

function DispersionFallback() {
  return (
    <div className="page-wide fade-up">
      <div className="eyebrow mb-2.5">02 · Dispersion</div>
      <p className="caption">Loading page…</p>
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
