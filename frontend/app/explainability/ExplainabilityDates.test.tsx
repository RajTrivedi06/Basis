import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ExplainabilityContent } from "@/components/ml/ExplainabilityContent";
import { ML_EXPLAINABILITY_FIXTURE } from "@/lib/mlExplainability";
import type { ExplainabilityArtifact } from "@/lib/mlExplainabilityTypes";

/**
 * A6: no date on this page may be hardcoded. Re-rendering the same component
 * with a different artifact must move every date it shows, so the 5.7 retrain
 * lands with zero copy edits.
 */
function withTrainedAt(
  trainedAt: string,
  corpusThrough: string
): ExplainabilityArtifact {
  return {
    ...ML_EXPLAINABILITY_FIXTURE,
    metadata: {
      ...ML_EXPLAINABILITY_FIXTURE.metadata,
      trained_at: trainedAt,
      corpus_through: corpusThrough,
    },
  };
}

describe("explainability dates interpolate from the artifact", () => {
  it("renders the artifact's trained date, not a fixed one", () => {
    const { unmount } = render(
      <ExplainabilityContent
        artifact={withTrainedAt("2026-07-31T09:00:00Z", "2026-07-30")}
      />
    );

    // Memo stamps: TRAINED JUL 31 (meta + corpus foot) and CORPUS THROUGH JUL 30.
    expect(screen.getAllByText(/TRAINED JUL 31/).length).toBeGreaterThanOrEqual(
      1
    );
    expect(screen.getByText(/CORPUS THROUGH JUL 30/)).toBeInTheDocument();

    unmount();

    render(
      <ExplainabilityContent
        artifact={withTrainedAt("2026-09-04T09:00:00Z", "2026-09-03")}
      />
    );

    expect(screen.getAllByText(/TRAINED SEP 4/).length).toBeGreaterThanOrEqual(
      1
    );
    expect(screen.queryByText(/JUL 31/)).not.toBeInTheDocument();
    expect(screen.queryByText(/2026-07-31/)).not.toBeInTheDocument();
  });

  it("names the SKU from the artifact", () => {
    render(<ExplainabilityContent artifact={ML_EXPLAINABILITY_FIXTURE} />);

    expect(
      screen.getByText(new RegExp(ML_EXPLAINABILITY_FIXTURE.metadata.sku))
    ).toBeInTheDocument();
  });

  it("offers the ICC definition where the ICC number is shown", async () => {
    const user = userEvent.setup();
    render(<ExplainabilityContent artifact={ML_EXPLAINABILITY_FIXTURE} />);

    const trigger = screen.getByRole("button", { name: "ICC" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);

    expect(screen.getByRole("note")).toHaveTextContent(
      "how much of the leftover variation sticks to the same specific machines day after day."
    );
  });
});
