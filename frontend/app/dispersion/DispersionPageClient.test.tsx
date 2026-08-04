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

describe("DispersionPageClient — declassified observation sheet", () => {
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

    expect(screen.getByText(/03 · How to read this chart/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Median" })).toBeInTheDocument();

    const toggle = screen.getByRole("button", {
      name: /show me how the band is built/i,
    });
    await user.click(toggle);

    expect(
      screen.getByText(/at least three offers or it is held out/i)
    ).toBeInTheDocument();
  });

  it("explains its jargon in place", async () => {
    const user = userEvent.setup();
    renderWithQuery(<DispersionPageClient />);

    await user.click(
      screen.getByRole("button", { name: /show me how the band is built/i })
    );
    await user.click(screen.getByRole("button", { name: "residual" }));

    expect(screen.getByRole("note")).toHaveTextContent(
      "the share of price differences left over after accounting for everything sellers publicly disclose."
    );
  });

  it("stamps the sheet and links forward to the decomposition", async () => {
    const { container } = renderWithQuery(<DispersionPageClient />);

    expect(await screen.findByText(/SHEET 02 OF 06/)).toBeInTheDocument();
    // Stamp date interpolates from the latest point once the shared query resolves.
    await screen.findByText(/2 days · 2,500 offers/);
    expect(container.querySelector(".disp-sheet-foot__stamp")?.textContent).toMatch(
      /JUL 30/
    );
    expect(
      screen.getByRole("link", {
        name: /Next: which factors absorb the disagreement/i,
      })
    ).toHaveAttribute("href", "/basis");
  });
});

