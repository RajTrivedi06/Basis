import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MethodologyHero } from "@/app/methodology/MethodologyHero";
import { getProviders } from "@/lib/api";
import { PROVIDER_STALE_AFTER_DAYS } from "@/lib/providerStatus";
import { renderWithQuery } from "@/test/test-utils";

vi.mock("@/lib/api", () => ({
  getProviders: vi.fn(),
}));

const mockedGetProviders = vi.mocked(getProviders);

const DAY_MS = 24 * 60 * 60 * 1000;
const hoursAgo = (hours: number) =>
  new Date(Date.now() - hours * 3_600_000).toISOString();
const daysAgo = (days: number) =>
  new Date(Date.now() - days * DAY_MS).toISOString();

function provider(name: string, latest: string | null) {
  return {
    provider: name,
    offer_count: 1_000,
    distinct_skus: 10,
    median_deviation_pct: null,
    latest_collection: latest,
  };
}

describe("MethodologyHero", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the C15 headline", async () => {
    mockedGetProviders.mockResolvedValue({ items: [] });
    renderWithQuery(<MethodologyHero />);

    expect(
      screen.getByRole("heading", {
        name: /Measuring what the market cannot explain\./i,
      })
    ).toBeInTheDocument();
  });

  it("counts only providers still collecting", async () => {
    mockedGetProviders.mockResolvedValue({
      items: [
        provider("a", hoursAgo(2)),
        provider("b", hoursAgo(5)),
        provider("c", daysAgo(PROVIDER_STALE_AFTER_DAYS + 4)),
        provider("d", null),
      ],
    });
    renderWithQuery(<MethodologyHero />);

    // Four rows, two of them stale — the strip must say two.
    await waitFor(() => {
      const cell = screen
        .getByText("Active providers")
        .closest(".stat-tape__cell");
      expect(cell!.textContent).toContain("2");
    });
  });

  it("degrades to an em dash rather than a stale number", () => {
    mockedGetProviders.mockReturnValue(new Promise(() => {}));
    renderWithQuery(<MethodologyHero />);

    const cell = screen.getByText("Active providers").closest(".stat-tape__cell");
    expect(cell!.textContent).toContain("—");
  });

  it("states the residual as a range, not a point value", () => {
    mockedGetProviders.mockResolvedValue({ items: [] });
    renderWithQuery(<MethodologyHero />);

    expect(screen.getByText("~20–61%")).toBeInTheDocument();
  });
});
