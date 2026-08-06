import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FindingsHero, iccQualifier } from "@/components/FindingsHero";
import { getBasisTimeseries } from "@/lib/api";
import { renderWithQuery } from "@/test/test-utils";

vi.mock("@/lib/api", () => ({
  getBasisTimeseries: vi.fn(),
}));

vi.mock("@/lib/useSku", () => ({
  useSku: () => ({ sku: "h100_sxm_80gb", setSku: vi.fn() }),
}));

vi.mock("@/lib/mlExplainability", () => ({
  getMlExplainability: vi.fn().mockResolvedValue({
    metadata: { trained_at: "2026-07-31T00:00:00Z" },
    metrics: { gap: -0.109, anova_explained_same_days: 0.393 },
    host_analysis: { icc: 0.554 },
  }),
}));

const mockedTimeseries = vi.mocked(getBasisTimeseries);

// 30 real-shaped days spanning both era annotations (Jul 26 / Jul 28).
const points = Array.from({ length: 30 }, (_, i) => {
  const day = new Date(Date.UTC(2026, 6, 5 + i));
  return {
    date: day.toISOString().slice(0, 10),
    gpu_sku: "h100_sxm_80gb",
    total_variance: 1,
    residual_variance: 0.5,
    pct_residual: 50 + ((i * 7) % 13) - 6,
  };
});

describe("FindingsHero: declassified memorandum", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedTimeseries.mockResolvedValue({
      gpu_sku: "h100_sxm_80gb",
      points,
    } as Awaited<ReturnType<typeof getBasisTimeseries>>);
  });

  it("requests the market-priced series, excluding the list catalogs", async () => {
    renderWithQuery(<FindingsHero />);
    await waitFor(() => expect(mockedTimeseries).toHaveBeenCalled());
    for (const call of mockedTimeseries.mock.calls) {
      expect(call[1]?.excludeProviders).toEqual(["azure", "gcp"]);
    }
  });

  it("files the four lines of inquiry with artifact-bound figures", async () => {
    renderWithQuery(<FindingsHero />);

    expect(await screen.findByText(/The file is public/)).toBeInTheDocument();
    expect(screen.getByText(/The cause is not/)).toBeInTheDocument();

    // A6: every figure interpolates from the artifact / live series.
    expect(await screen.findByText("CLAIMED 39.3%")).toBeInTheDocument();
    expect(screen.getByText("LESS · −10.9pp")).toBeInTheDocument();
    expect(screen.getByText("ICC 0.55")).toBeInTheDocument();
    // appears on the disclosure label and inside the precise claim
    expect(screen.getAllByText(/as of Jul 31/).length).toBeGreaterThan(0);

    // The frozen truth-patch sentences survive in the precise-claim layer.
    expect(
      screen.getByText(/Even a 45-feature ML model can’t close/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/has ranged ~20–61% across recent weeks/)
    ).toBeInTheDocument();
  });

  it("keeps the redaction bar as the only void encoding", async () => {
    const { container } = renderWithQuery(<FindingsHero />);
    await screen.findByText("ICC 0.55");
    const redactions = container.querySelectorAll(".memo-line__redaction");
    expect(redactions.length).toBe(1);
    // it sits on line 4: the unexplained remainder
    const line = redactions[0].closest(".memo-line") as HTMLElement;
    expect(within(line).getByText(/CAUSE OF REMAINDER/)).toBeInTheDocument();
  });

  it("scrubs, pins, and releases the exhibit from the keyboard", async () => {
    const user = userEvent.setup();
    renderWithQuery(<FindingsHero />);
    await screen.findByText("ICC 0.55");

    const plot = screen.getByRole("application", { name: /Daily unexplained/ });
    expect(screen.getByText("SCRUB THE RECORD →")).toBeInTheDocument();

    plot.focus();
    await user.keyboard("{ArrowLeft}");
    expect(await screen.findByText(/^READING /)).toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(await screen.findByText(/^PINNED /)).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.getByText("SCRUB THE RECORD →")).toBeInTheDocument();
  });

  it("jumps the reading to an era flag and pins it", async () => {
    const user = userEvent.setup();
    renderWithQuery(<FindingsHero />);
    await screen.findByText("ICC 0.55");

    const flag = screen.getByRole("button", { name: /ERA D/ });
    await user.click(flag);

    const readout = await screen.findByText(/^PINNED JUL 26/);
    expect(readout).toBeInTheDocument();
    expect(flag).toHaveAttribute("data-active", "true");
  });
});

describe("iccQualifier", () => {
  it("maps ICC bands to qualifiers that cannot contradict the figure", () => {
    expect(iccQualifier(0.554)).toBe("over half");
    expect(iccQualifier(0.42)).toBe("a third or more");
    expect(iccQualifier(0.2)).toBe("a persistent share");
  });
});
