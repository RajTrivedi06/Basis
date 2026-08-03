import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FindingsHero } from "@/components/FindingsHero";
import { getBasisTimeseries, getFungibilityMatrix, getProviders } from "@/lib/api";
import { renderWithQuery } from "@/test/test-utils";

vi.mock("@/lib/api", () => ({
  getBasisTimeseries: vi.fn(),
  getFungibilityMatrix: vi.fn(),
  getProviders: vi.fn(),
}));

vi.mock("@/lib/useSku", () => ({
  useSku: () => ({ sku: "h100_sxm_80gb", setSku: vi.fn() }),
}));

vi.mock("@/lib/mlExplainability", () => ({
  getMlExplainability: vi.fn().mockResolvedValue({
    metadata: { trained_at: "2026-07-31T00:00:00Z" },
    metrics: { gap: -0.109 },
    host_analysis: { icc: 0.554 },
  }),
}));

const mockedTimeseries = vi.mocked(getBasisTimeseries);
const mockedMatrix = vi.mocked(getFungibilityMatrix);
const mockedProviders = vi.mocked(getProviders);

describe("FindingsHero", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedTimeseries.mockResolvedValue({
      gpu_sku: "h100_sxm_80gb",
      points: [
        {
          date: "2026-07-30",
          gpu_sku: "h100_sxm_80gb",
          total_variance: 1,
          residual_variance: 0.4,
          pct_residual: 40,
        },
      ],
    } as Awaited<ReturnType<typeof getBasisTimeseries>>);
    mockedMatrix.mockResolvedValue({ items: [] });
    mockedProviders.mockResolvedValue({ items: [] });
  });

  it("requests the market-priced series, excluding the list catalogs", async () => {
    renderWithQuery(<FindingsHero />);

    await waitFor(() => {
      expect(mockedTimeseries).toHaveBeenCalled();
    });

    for (const call of mockedTimeseries.mock.calls) {
      expect(call[1]?.excludeProviders).toEqual(["azure", "gcp"]);
    }
  });

  it("leads with the plain-language headline and artifact-bound anchors", async () => {
    renderWithQuery(<FindingsHero />);

    expect(
      await screen.findByText(/A bigger model doesn’t explain it away/)
    ).toBeInTheDocument();
    // A6: the anchors interpolate from the artifact, not constants
    expect(await screen.findByText("−10.9pp")).toBeInTheDocument();
    expect(screen.getByText("0.55")).toBeInTheDocument();
    expect(screen.getByText(/as of Jul 31/)).toBeInTheDocument();
    expect(
      screen.getByText(/has ranged ~20–61% across recent weeks/)
    ).toBeInTheDocument();
    // the frozen sentence lives in the expansion, still in the DOM
    expect(
      screen.getByText(/Even a 45-feature ML model can’t close/)
    ).toBeInTheDocument();
  });
});

describe("iccQualifier — share language can never contradict the number", () => {
  it("maps ICC bands to honest qualifiers", async () => {
    const { iccQualifier } = await import("@/components/FindingsHero");
    expect(iccQualifier(0.554)).toBe("over half");
    expect(iccQualifier(0.42)).toBe("a third or more");
    expect(iccQualifier(0.2)).toBe("a persistent share");
  });
});
