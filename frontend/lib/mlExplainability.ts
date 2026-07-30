/**
 * ML explainability artifact client — GET /api/ml/explainability (Task 3.4).
 * Returns null when the artifact is not published (503) or unreachable.
 */

import fixtureArtifact from "@/fixtures/ml-explainability-artifact.json";
import type { ExplainabilityArtifact } from "@/lib/mlExplainabilityTypes";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export const ML_EXPLAINABILITY_FIXTURE: ExplainabilityArtifact =
  fixtureArtifact as ExplainabilityArtifact;

function shouldUseFixture(): boolean {
  return process.env.NEXT_PUBLIC_ML_EXPLAINABILITY_FIXTURE === "true";
}

export async function getMlExplainability(): Promise<ExplainabilityArtifact | null> {
  if (shouldUseFixture()) {
    return ML_EXPLAINABILITY_FIXTURE;
  }

  try {
    const res = await fetch(`${BASE_URL}/api/ml/explainability`, {
      headers: { Accept: "application/json" },
    });

    if (res.status === 503) {
      return null;
    }

    if (!res.ok) {
      return null;
    }

    return (await res.json()) as ExplainabilityArtifact;
  } catch {
    return null;
  }
}
