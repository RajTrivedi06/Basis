import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DispersionPageClient } from "@/app/dispersion/DispersionPageClient";
import { getDispersion, getGpuSkus } from "@/lib/api";
import { renderWithQuery } from "@/test/test-utils";

vi.mock("@/lib/api", () => ({
  getDispersion: vi.fn(),
  getGpuSkus: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

const mockedGetDispersion = vi.mocked(getDispersion);
const mockedGetGpuSkus = vi.mocked(getGpuSkus);

describe("DispersionPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetGpuSkus.mockResolvedValue({ items: [] });
    mockedGetDispersion.mockResolvedValue({
      gpu_sku: "h100_sxm_80gb",
      points: [
        {
          date: "2026-07-29",
          gpu_sku: "h100_sxm_80gb",
          observation_count: 1200,
          median_price: 2.1,
          p25_price: 1.4,
          p75_price: 3.2,
          iqr: 1.8,
          coefficient_of_variation: null,
        },
        {
          date: "2026-07-30",
          gpu_sku: "h100_sxm_80gb",
          observation_count: 1300,
          median_price: 2.2,
          p25_price: 1.5,
          p75_price: 3.3,
          iqr: 1.8,
          coefficient_of_variation: null,
        },
      ],
    });
  });

  it("summarises the window from live data", async () => {
    renderWithQuery(<DispersionPageClient />);

    expect(await screen.findByText(/2 days · 2,500 offers/)).toBeInTheDocument();
  });

  it("keeps the plain-English reading guide above the mechanics", async () => {
    const user = userEvent.setup();
    renderWithQuery(<DispersionPageClient />);

    expect(
      screen.getByRole("heading", { name: "How to read this chart" })
    ).toBeInTheDocument();

    const toggle = screen.getByText("Show me how the band is built");
    await user.click(toggle);

    expect(
      screen.getByText(/at least three offers to be plotted at all/)
    ).toBeInTheDocument();
  });

  it("explains its jargon in place", async () => {
    const user = userEvent.setup();
    renderWithQuery(<DispersionPageClient />);

    await user.click(screen.getByRole("button", { name: "residual" }));

    expect(screen.getByRole("note")).toHaveTextContent(
      "the share of price differences left over after accounting for everything sellers publicly disclose."
    );
  });
});
