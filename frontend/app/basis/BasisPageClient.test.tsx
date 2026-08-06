import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BasisPageClient } from "@/app/basis/BasisPageClient";
import {
  getBasisDecomposition,
  getDecompositionObservations,
  getGpuSkus,
} from "@/lib/api";
import { renderWithQuery } from "@/test/test-utils";

vi.mock("@/lib/api", () => ({
  getBasisDecomposition: vi.fn(),
  getDecompositionObservations: vi.fn(),
  getGpuSkus: vi.fn(),
  getDispersion: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

const mockedBasis = vi.mocked(getBasisDecomposition);
const mockedObs = vi.mocked(getDecompositionObservations);
const mockedSkus = vi.mocked(getGpuSkus);

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

describe("BasisPageClient: settlement sheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSkus.mockResolvedValue({ items: [] });
    mockedBasis.mockResolvedValue(live);
    mockedObs.mockResolvedValue({
      gpu_sku: live.gpu_sku,
      date: live.date,
      items: [],
    });
  });

  it("renders the settlement head and ledger chrome", async () => {
    renderWithQuery(<BasisPageClient />);

    expect(
      await screen.findByRole("heading", {
        name: /Four factors take their turn/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/03 · Variance settlement/i)).toBeInTheDocument();
    expect(
      await screen.findByText(/SETTLEMENT SHEET · SEQUENTIAL ANOVA/i)
    ).toBeInTheDocument();
    expect(await screen.findByText("Unexplained")).toBeInTheDocument();
  });

  it("shows the schedule of accounts with a running balance", async () => {
    const { container } = renderWithQuery(<BasisPageClient />);
    await screen.findByText("Unexplained");

    expect(screen.getByText(/04 · Schedule of accounts/i)).toBeInTheDocument();
    const rows = container.querySelectorAll(".account-row");
    expect(rows.length).toBe(5);

    const residual = within(rows[4] as HTMLElement);
    expect(residual.getByText("CANNOT BE FILED")).toBeInTheDocument();
    expect(residual.getByText("61.3%")).toBeInTheDocument();
  });

  it("reveals the ledger-order protocol on demand", async () => {
    const user = userEvent.setup();
    renderWithQuery(<BasisPageClient />);
    await screen.findByText("Unexplained");

    await user.click(
      screen.getByRole("button", {
        name: /show me how the ledger is ordered/i,
      })
    );
    expect(
      screen.getByText(/region → commitment → provider → bundle → residual/)
    ).toBeInTheDocument();
  });

  it("links forward to the honesty bound", async () => {
    renderWithQuery(<BasisPageClient />);
    await screen.findByText(/SHEET 03 OF 06/);

    expect(
      screen.getByRole("link", { name: /Next: the honesty bound/i })
    ).toHaveAttribute("href", "/explainability");
  });
});
