import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMlExplainability } from "@/lib/mlExplainability";

vi.mock("@/lib/mlExplainability", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mlExplainability")>();
  return {
    ...actual,
    getMlExplainability: vi.fn(),
  };
});
import {
  ExplainabilityContent,
  ExplainabilityEmptyState,
} from "@/components/ml/ExplainabilityContent";
import { ShapFeaturesChart } from "@/components/ml/ShapFeaturesChart";
import { ML_EXPLAINABILITY_FIXTURE } from "@/lib/mlExplainability";
import { ExplainabilityPageClient } from "@/app/explainability/ExplainabilityPageClient";
import { renderWithQuery } from "@/test/test-utils";

describe("ExplainabilityContent: design 5b two-card file", () => {
  const artifact = ML_EXPLAINABILITY_FIXTURE;

  it("renders bound numbers from the artifact", () => {
    render(<ExplainabilityContent artifact={artifact} />);

    expect(
      screen.getByRole("img", {
        name: /Bound bar: GBM holdout R² 45\.4%, ANOVA explained 56\.3%, gap −10\.9 pp/,
      })
    ).toBeInTheDocument();
    expect(screen.getByText("−10.9 pp")).toBeInTheDocument();
    expect(screen.getByText("EXHIBIT I: THE BOUND")).toBeInTheDocument();
  });

  it("renders caveats verbatim", () => {
    render(<ExplainabilityContent artifact={artifact} />);

    for (const caveat of artifact.caveats) {
      expect(screen.getByText(caveat)).toBeInTheDocument();
    }
  });

  it("renders host ICC and host count", () => {
    render(<ExplainabilityContent artifact={artifact} />);

    expect(screen.getByText("0.34")).toBeInTheDocument();
    expect(screen.getByText("61")).toBeInTheDocument();
    expect(screen.getByText(/HOSTS ≥10D/i)).toBeInTheDocument();
    expect(screen.getByText("EXHIBIT II: THE HOST")).toBeInTheDocument();
  });

  it("renders per-provider holdout R² as punch cards", () => {
    render(<ExplainabilityContent artifact={artifact} />);

    expect(screen.getByText("0.62")).toBeInTheDocument();
    expect(screen.getByText("0.51")).toBeInTheDocument();
    expect(screen.getByText("VAST")).toBeInTheDocument();
  });

  it("shows ICC sensitivity leaders without a disclosure", () => {
    render(<ExplainabilityContent artifact={artifact} />);

    expect(
      screen.getByText(/ICC SENSITIVITY BY TENURE THRESHOLD/i)
    ).toBeInTheDocument();
    expect(screen.getByText("0.29")).toBeInTheDocument();
    expect(screen.getByText("0.41")).toBeInTheDocument();
    expect(screen.getByText(/0\.34 · PRIMARY/)).toBeInTheDocument();
  });
});

describe("ShapFeaturesChart", () => {
  it("renders one bar row per feature", () => {
    const features = ML_EXPLAINABILITY_FIXTURE.shap_summary.top_features;
    const { container } = render(<ShapFeaturesChart features={features} />);

    const bars = container.querySelectorAll("rect");
    expect(bars).toHaveLength(features.length);
  });

  it("shows empty message when top_features is empty", () => {
    render(<ShapFeaturesChart features={[]} />);
    expect(
      screen.getByText("No SHAP features in this artifact.")
    ).toBeInTheDocument();
  });
});

describe("ExplainabilityPageClient", () => {
  beforeEach(() => {
    vi.mocked(getMlExplainability).mockReset();
  });

  it("shows empty state when API returns null (503)", async () => {
    vi.mocked(getMlExplainability).mockResolvedValue(null);

    renderWithQuery(<ExplainabilityPageClient />);

    expect(
      await screen.findByText("Results not yet published")
    ).toBeInTheDocument();
  });

  it("renders artifact when API returns data", async () => {
    vi.mocked(getMlExplainability).mockResolvedValue(ML_EXPLAINABILITY_FIXTURE);

    renderWithQuery(<ExplainabilityPageClient />);

    expect(
      await screen.findByRole("heading", {
        name: /Two exhibits\. Neither one closes the file/i,
      })
    ).toBeInTheDocument();
    expect(
      await screen.findByText("EXHIBIT I: THE BOUND")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: /Bound bar: GBM holdout R² 45\.4%/,
      })
    ).toBeInTheDocument();
  });
});

describe("ExplainabilityEmptyState", () => {
  it("renders the published-not-yet message", () => {
    render(<ExplainabilityEmptyState />);
    expect(screen.getByText("Results not yet published")).toBeInTheDocument();
  });
});
