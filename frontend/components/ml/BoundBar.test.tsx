import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BoundBar } from "@/components/ml/BoundBar";

const GAP_COLOR = "var(--verdict-ok)";

/** Real Stage 3 trained artifact (negative gap). */
export const NEGATIVE_GAP_FIXTURE = {
  anovaExplained: 0.563,
  gbmR2: 0.454,
  gap: -0.109,
} as const;

function segmentWidths(container: HTMLElement): number[] {
  return [...container.querySelectorAll('[data-testid="bound-bar-segment"]')].map(
    (node) => parseFloat((node as HTMLElement).style.width)
  );
}

function totalSegmentWidth(container: HTMLElement): number {
  return segmentWidths(container).reduce((sum, width) => sum + width, 0);
}

describe("BoundBar", () => {
  it("renders positive gap with green segment and residual last", () => {
    const { container } = render(
      <BoundBar anovaExplained={0.42} gbmR2={0.58} gap={0.16} />
    );

    const bar = container.querySelector('[role="img"]') as HTMLElement;
    const segments = bar.querySelectorAll<HTMLElement>('[data-testid="bound-bar-segment"]');
    expect(segments.length).toBe(3);

    const colors = [...segments].map((s) => s.style.background);
    expect(colors).toContain(GAP_COLOR);

    const last = segments[segments.length - 1];
    expect(last.style.background).toBe("var(--residual)");
    expect(screen.getByText(/Residual · 42\.0%/)).toBeInTheDocument();
    expect(screen.getByText("16.0 pp")).toBeInTheDocument();
    expect(totalSegmentWidth(bar)).toBeLessThanOrEqual(100.01);
    expect(screen.queryByTestId("gbm-bound-marker")).not.toBeInTheDocument();
  });

  it("renders negative gap with marker, no green segment, and signed gap", () => {
    const { container } = render(<BoundBar {...NEGATIVE_GAP_FIXTURE} />);

    const bar = container.querySelector('[role="img"]') as HTMLElement;
    const segments = bar.querySelectorAll<HTMLElement>('[data-testid="bound-bar-segment"]');
    expect(segments.length).toBe(2);

    const colors = [...segments].map((s) => s.style.background);
    expect(colors).not.toContain(GAP_COLOR);
    expect(colors[0]).toBe("var(--factor-provider)");
    expect(colors[1]).toBe("var(--residual)");

    const marker = screen.getByTestId("gbm-bound-marker");
    expect(marker).toBeInTheDocument();
    expect(marker.style.left).toBe("45.4%");

    expect(screen.getByText("−10.9 pp")).toBeInTheDocument();
    expect(screen.getByText(/Residual · 43\.7%/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Out-of-sample bound \(45\.4%\) sits below the in-sample 4-factor share \(56\.3%\)/
      )
    ).toBeInTheDocument();
    expect(totalSegmentWidth(bar)).toBeLessThanOrEqual(100.01);
  });

  it("renders gap exactly zero without a green segment", () => {
    const { container } = render(
      <BoundBar anovaExplained={0.5} gbmR2={0.5} gap={0} />
    );

    const bar = container.querySelector('[role="img"]') as HTMLElement;
    const segments = bar.querySelectorAll<HTMLElement>('[data-testid="bound-bar-segment"]');
    expect(segments.length).toBe(2);

    const colors = [...segments].map((s) => s.style.background);
    expect(colors).not.toContain(GAP_COLOR);
    expect(screen.getByText("0.0 pp")).toBeInTheDocument();
    expect(totalSegmentWidth(bar)).toBeLessThanOrEqual(100.01);
  });
});
