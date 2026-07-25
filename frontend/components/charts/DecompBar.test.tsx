import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DecompBar } from "@/components/charts/DecompBar";
import { factorColor } from "@/lib/factorColor";

describe("DecompBar", () => {
  const decomp = {
    region: 0.1,
    commitment: 0.15,
    provider: 0.2,
    bundle: 0.05,
    residual: 0.5,
  };

  it("renders segments in model order: region → commitment → provider → bundle → residual", () => {
    const { container } = render(<DecompBar decomp={decomp} showLabels={false} />);
    const bar = container.querySelector('[role="img"]');
    expect(bar).not.toBeNull();

    const segments = bar!.querySelectorAll<HTMLElement>(":scope > div");
    expect(segments).toHaveLength(5);

    const expectedOrder = [
      "region",
      "commitment",
      "provider",
      "bundle",
      "residual",
    ] as const;

    expectedOrder.forEach((key, index) => {
      const segment = segments[index];
      if (key === "residual") {
        expect(segment.style.background).toBe("var(--residual)");
      } else {
        expect(segment.style.background).toBe(factorColor(key));
      }
    });
  });

  it("segment widths sum to 100%", () => {
    const { container } = render(<DecompBar decomp={decomp} showLabels={false} />);
    const bar = container.querySelector('[role="img"]');
    const segments = bar!.querySelectorAll<HTMLElement>(":scope > div");

    const totalWidth = Array.from(segments).reduce((sum, segment) => {
      const width = parseFloat(segment.style.width);
      return sum + width;
    }, 0);

    expect(totalWidth).toBeCloseTo(100, 5);
  });

  it("shows residual share in the legend", () => {
    render(<DecompBar decomp={decomp} />);
    expect(screen.getByText(/Residual · 50\.0%/)).toBeInTheDocument();
  });
});
