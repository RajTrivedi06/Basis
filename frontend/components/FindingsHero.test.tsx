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

  it("leads with the anchored structural claims", async () => {
    renderWithQuery(<FindingsHero />);

    expect(
      await screen.findByText(/Even a 45-feature ML model can’t close/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/has ranged ~20–61% across recent weeks/)
    ).toBeInTheDocument();
  });
});
