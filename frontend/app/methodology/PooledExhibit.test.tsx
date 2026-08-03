import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PooledExhibit } from "@/app/methodology/PooledExhibit";
import { getBasisTimeseries } from "@/lib/api";
import { renderWithQuery } from "@/test/test-utils";

vi.mock("@/lib/api", () => ({
  getBasisTimeseries: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

const mockedGetBasisTimeseries = vi.mocked(getBasisTimeseries);

function point(date: string, pctResidual: number) {
  return {
    date,
    gpu_sku: "h100_sxm_80gb",
    total_variance: 0.8,
    variance_from_region: 0.05,
    variance_from_commitment: 0.05,
    variance_from_bundle: 0.05,
    variance_from_provider: 0.05,
    residual_variance: 0.6,
    pct_explained: 100 - pctResidual,
    pct_residual: pctResidual,
  };
}

// Spans both era annotations (Jul 26 and Jul 28) so the markers must render.
const DATES = ["2026-07-24", "2026-07-26", "2026-07-28", "2026-07-30"];

describe("PooledExhibit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetBasisTimeseries.mockImplementation(async (_sku, params) => {
      const excluded = params?.excludeProviders ?? [];
      // The pooled series collapses once the fixed catalogs join; the
      // market-priced series keeps moving.
      const values = excluded.length > 0 ? [55, 61, 48, 52] : [55, 61, 9, 7];
      return {
        gpu_sku: "h100_sxm_80gb",
        points: DATES.map((date, i) => point(date, values[i])),
      };
    });
  });

  it("requests one pooled series and one with the catalogs excluded", async () => {
    renderWithQuery(<PooledExhibit />);
    await screen.findByText(/Pooled · every provider/);

    const calls = mockedGetBasisTimeseries.mock.calls;
    expect(calls).toHaveLength(2);

    const exclusions = calls.map((call) => call[1]?.excludeProviders ?? null);
    expect(exclusions).toContainEqual(null);
    expect(exclusions).toContainEqual(["azure", "gcp"]);
  });

  it("renders both series with their own latest value", async () => {
    renderWithQuery(<PooledExhibit />);

    const pooled = (await screen.findByText(/Pooled · every provider/)).closest(
      ".pooled-panel"
    );
    const market = screen
      .getByText(/Market-priced · catalogs excluded/)
      .closest(".pooled-panel");

    expect(pooled).not.toBeNull();
    expect(market).not.toBeNull();
    expect(within(pooled as HTMLElement).getByText(/7\.0% · 2026-07-30/)).toBeInTheDocument();
    expect(within(market as HTMLElement).getByText(/52\.0% · 2026-07-30/)).toBeInTheDocument();

    // Each panel draws its own polyline from the real point values.
    expect(pooled!.querySelectorAll("polyline")).toHaveLength(1);
    expect(market!.querySelectorAll("polyline")).toHaveLength(1);
  });

  it("marks the era-D and catalog-join dates on both charts", async () => {
    renderWithQuery(<PooledExhibit />);
    await screen.findByText(/Pooled · every provider/);

    // Two rules per chart, two charts.
    expect(document.querySelectorAll("line[stroke-dasharray]")).toHaveLength(4);

    expect(
      screen.getByText(/Jul 26 · Era D — Vast spot becomes visible/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Jul 28 · Azure\/GCP list catalogs join/)
    ).toBeInTheDocument();
  });

  it("frames the exhibit with the C19 headline", async () => {
    renderWithQuery(<PooledExhibit />);

    expect(
      await screen.findByRole("heading", { name: /Why pooling misleads/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Add two fixed price catalogs and the pooled residual collapses — while the market keeps moving\./
      )
    ).toBeInTheDocument();
  });
});
