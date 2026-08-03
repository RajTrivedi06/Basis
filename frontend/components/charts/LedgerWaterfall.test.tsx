import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LedgerWaterfall } from "@/components/charts/LedgerWaterfall";

const live = {
  date: "2026-08-02",
  gpu_sku: "h100_sxm_80gb",
  total_variance: 1,
  variance_from_region: 0.048,
  variance_from_commitment: 0.069,
  variance_from_bundle: 0.083,
  variance_from_provider: 0.187,
  residual_variance: 0.613,
  pct_explained: 38.7,
  pct_residual: 61.3,
};

function rowLefts(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll(".ledger__left")).map(
    (node) => node.textContent ?? ""
  );
}

describe("LedgerWaterfall", () => {
  it("opens the ledger at 100%", () => {
    render(<LedgerWaterfall decomposition={live} />);
    expect(
      screen.getByText("The price we can't explain, before accounting")
    ).toBeInTheDocument();
    expect(screen.getByText("100.0%")).toBeInTheDocument();
  });

  it("prints each factor's share in its own row, in model order", () => {
    const { container } = render(<LedgerWaterfall decomposition={live} />);

    const tags = Array.from(container.querySelectorAll(".ledger__row .ledger__tag")).map(
      (node) => node.textContent
    );
    expect(tags).toEqual(["REGION", "COMMITMENT", "PROVIDER", "BUNDLE"]);

    const shares = Array.from(container.querySelectorAll(".ledger__share")).map(
      (node) => node.textContent
    );
    expect(shares).toEqual(["4.8%", "6.9%", "18.7%", "8.3%"]);
  });

  it("tallies the 'X left' column down to the residual", () => {
    const { container } = render(<LedgerWaterfall decomposition={live} />);
    expect(rowLefts(container)).toEqual([
      "95.2 left",
      "88.3 left",
      "69.6 left",
      "61.3 left",
    ]);
    expect(container.querySelector(".ledger__void-value")!.textContent).toBe(
      "61.3%"
    );
  });

  it("renders whatever factor count the API returns", () => {
    const { container } = render(
      <LedgerWaterfall
        decomposition={{
          total_variance: 1,
          variance_from_region: 0.1,
          variance_from_commitment: 0.1,
          variance_from_provider: 0.1,
          variance_from_bundle: 0.1,
          variance_from_host_class: 0.2,
          residual_variance: 0.4,
        }}
      />
    );

    expect(container.querySelectorAll(".ledger__row")).toHaveLength(5);
    expect(rowLefts(container)).toEqual([
      "90.0 left",
      "80.0 left",
      "70.0 left",
      "60.0 left",
      "40.0 left",
    ]);
    expect(container.querySelector(".ledger__void-value")!.textContent).toBe(
      "40.0%"
    );

    const { container: three } = render(
      <LedgerWaterfall
        decomposition={{
          total_variance: 1,
          variance_from_region: 0.2,
          variance_from_commitment: 0.2,
          variance_from_provider: 0.2,
          residual_variance: 0.4,
        }}
      />
    );
    expect(three.querySelectorAll(".ledger__row")).toHaveLength(3);
  });

  it("measures the remainder with a bracket sized to the residual", () => {
    const { container } = render(<LedgerWaterfall decomposition={live} />);
    const measure = container.querySelector<HTMLElement>(".ledger__measure")!;
    expect(parseFloat(measure.style.width)).toBeCloseTo(61.3, 6);
    expect(container.querySelector(".ledger__measure-caption")!.textContent).toBe(
      "61.3 of every 100 · unaccounted"
    );
  });

  it("renders finished by default — the Basis page and every server render", () => {
    const { container } = render(<LedgerWaterfall decomposition={live} />);
    const rows = container.querySelectorAll<HTMLElement>(".ledger__row");
    rows.forEach((row) => expect(row.style.opacity).toBe("1"));

    const slices = container.querySelectorAll<HTMLElement>(
      ".ledger__depletion-slice"
    );
    expect(slices[0].style.width).toBe("4.8%");
  });

  it("fills depletion bars and stamps rows from the scrub", () => {
    const { container } = render(
      <LedgerWaterfall decomposition={live} progress={0.1} />
    );

    const rows = container.querySelectorAll<HTMLElement>(".ledger__row");
    // Five steps (four factors, then the void block): 0.1 puts row 1 halfway.
    expect(rows[0].style.opacity).toBe("1");
    expect(rows[1].style.opacity).toBe("0");

    const slices = container.querySelectorAll<HTMLElement>(
      ".ledger__depletion-slice"
    );
    expect(parseFloat(slices[0].style.width)).toBeCloseTo(2.4, 6);
    expect(parseFloat(slices[1].style.width)).toBe(0);

    // The remainder tallies down with the fill rather than jumping.
    expect(rowLefts(container)[0]).toBe("97.6 left");
  });

  it("lands the void block last under a global scrub", () => {
    const { container: mid } = render(
      <LedgerWaterfall decomposition={live} progress={0.8} />
    );
    expect(
      mid.querySelector<HTMLElement>(".ledger__void")!.style.opacity
    ).toBe("0");

    const { container: done } = render(
      <LedgerWaterfall decomposition={live} progress={1} />
    );
    expect(
      done.querySelector<HTMLElement>(".ledger__void")!.style.opacity
    ).toBe("1");
  });

  it("keeps the one-line stacked bar above as the glance-glyph", () => {
    const { container } = render(
      <LedgerWaterfall decomposition={live} glanceLabel="h100_sxm_80gb" />
    );

    const glyph = container.querySelector<HTMLElement>(".ledger__glyph")!;
    const segments = glyph.querySelectorAll<HTMLElement>("span");
    expect(segments).toHaveLength(5);
    expect(segments[4].style.background).toBe("var(--residual)");
    expect(glyph.getAttribute("aria-label")).toContain("61.3% unexplained");

    const { container: without } = render(
      <LedgerWaterfall decomposition={live} showGlanceGlyph={false} />
    );
    expect(without.querySelector(".ledger__glyph")).toBeNull();
  });

  it("encodes the unexplained share in void and nothing else", () => {
    const { container } = render(<LedgerWaterfall decomposition={live} />);

    const slices = Array.from(
      container.querySelectorAll<HTMLElement>(".ledger__depletion-slice")
    ).map((slice) => slice.style.background);
    expect(slices).toEqual([
      "var(--factor-region)",
      "var(--factor-commitment)",
      "var(--factor-provider)",
      "var(--factor-bundle)",
    ]);
    expect(slices).not.toContain("var(--residual)");
  });
});
