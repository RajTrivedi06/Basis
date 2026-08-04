import type { ExplainabilityArtifact } from "@/lib/mlExplainabilityTypes";
import { TwoCardFile } from "@/components/explainability/TwoCardFile";

interface ExplainabilityContentProps {
  artifact: ExplainabilityArtifact;
}

/**
 * Explainability page body — design 5b two-card file.
 * Every figure is read from the artifact (A6).
 */
export function ExplainabilityContent({ artifact }: ExplainabilityContentProps) {
  return <TwoCardFile artifact={artifact} />;
}

export function ExplainabilityEmptyState() {
  return (
    <div className="exhibit-empty">
      <div className="exhibit-empty__label">Results not yet published</div>
      <p className="exhibit-empty__body">
        The ML explainability artifact has not been uploaded yet, or the API
        could not reach it. This section will populate automatically once the
        training run completes and the artifact is served from{" "}
        <span className="mono">GET /api/ml/explainability</span>.
      </p>
    </div>
  );
}

export function ExplainabilityLoadingState() {
  return (
    <div className="exhibit-empty">
      <div className="exhibit-empty__label">Loading explainability results…</div>
      <p className="exhibit-empty__body exhibit-empty__body--dim">
        Fetching the precomputed artifact from the API.
      </p>
    </div>
  );
}
