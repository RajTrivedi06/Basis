import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
import { BoundBar } from "@/components/ml/BoundBar";
import { ShapFeaturesChart } from "@/components/ml/ShapFeaturesChart";
import { ML_EXPLAINABILITY_FIXTURE } from "@/lib/mlExplainability";
import { ExplainabilityPageClient } from "@/app/explainability/ExplainabilityPageClient";
import { renderWithQuery } from "@/test/test-utils";

describe("ExplainabilityContent", () => {
  const artifact = ML_EXPLAINABILITY_FIXTURE;

  it("renders bound numbers from the artifact", () => {
    render(<ExplainabilityContent artifact={artifact} />);

    expect(
      screen.getByRole("img", {
        name: /Bound bar: GBM holdout R² 58\.0%, ANOVA explained 42\.0%, gap 16\.0%/,
      })
    ).toBeInTheDocument();
    expect(screen.getByText("16.0 pp")).toBeInTheDocument();
  });

  it("renders caveats verbatim", () => {
    render(<ExplainabilityContent artifact={artifact} />);

    for (const caveat of artifact.caveats) {
      expect(screen.getByText(caveat)).toBeInTheDocument();
    }
  });

  it("renders host ICC and host count", () => {
    render(<ExplainabilityContent artifact={artifact} />);

    expect(screen.getByText("0.340")).toBeInTheDocument();
    expect(screen.getByText("61")).toBeInTheDocument();
    expect(screen.getByText(/threshold 10 observed days/)).toBeInTheDocument();
  });

  it("renders per-provider holdout R²", () => {
    render(<ExplainabilityContent artifact={artifact} />);

    expect(screen.getByText("62.0%")).toBeInTheDocument();
    expect(screen.getByText("51.0%")).toBeInTheDocument();
  });
});

describe("BoundBar", () => {
  it("places amber residual segment last and labels unexplained share", () => {
    const { container } = render(
      <BoundBar anovaExplained={0.42} gbmR2={0.58} gap={0.16} />
    );

    const bar = container.querySelector('[role="img"]');
    const segments = bar!.querySelectorAll<HTMLElement>(":scope > div");
    expect(segments.length).toBeGreaterThanOrEqual(2);

    const last = segments[segments.length - 1];
    expect(last.style.background).toBe("var(--residual)");
    expect(screen.getByText(/Residual · 42\.0%/)).toBeInTheDocument();
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

describe("HostEffectsStat sensitivity", () => {
  it("exposes sensitivity ICC values when expanded", async () => {
    const user = userEvent.setup();
    render(<ExplainabilityContent artifact={ML_EXPLAINABILITY_FIXTURE} />);

    await user.click(
      screen.getByRole("button", {
        name: /ICC sensitivity by host tenure threshold/i,
      })
    );

    expect(screen.getByText(/≥ 5 days: ICC 0\.290/)).toBeInTheDocument();
    expect(screen.getByText(/≥ 20 days: ICC 0\.410/)).toBeInTheDocument();
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
      await screen.findByText("The bound · residual-first")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: /Bound bar: GBM holdout R² 58\.0%/,
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
