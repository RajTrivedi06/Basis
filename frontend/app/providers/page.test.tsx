import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProvidersPage from "@/app/providers/page";
import { getProviders } from "@/lib/api";
import { PROVIDER_STALE_AFTER_DAYS } from "@/lib/providerStatus";
import { renderWithQuery } from "@/test/test-utils";

vi.mock("@/lib/api", () => ({
  getProviders: vi.fn(),
}));

const mockedGetProviders = vi.mocked(getProviders);

const DAY_MS = 24 * 60 * 60 * 1000;
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString();

/**
 * Dates are relative to the current clock rather than fixed strings, so the
 * fixture stays stale/fresh forever without mocking timers.
 */
const items = [
  {
    provider: "stale_marketplace",
    offer_count: 900_000,
    distinct_skus: 40,
    median_deviation_pct: null,
    latest_collection: daysAgo(PROVIDER_STALE_AFTER_DAYS + 23),
  },
  {
    provider: "busy_marketplace",
    offer_count: 400_000,
    distinct_skus: 91,
    median_deviation_pct: -11.4,
    latest_collection: hoursAgo(1),
  },
  {
    provider: "small_neocloud",
    offer_count: 8_000,
    distinct_skus: 7,
    median_deviation_pct: 66.5,
    latest_collection: hoursAgo(6),
  },
];

function providerRows() {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => row.textContent ?? "");
}

/** Scoped to the table: the caption below it also uses the word "Retired". */
function retiredTags() {
  return within(screen.getByRole("table")).queryAllByText("Retired");
}

describe("ProvidersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetProviders.mockResolvedValue({ items });
  });

  it("tags a provider that has not collected within the staleness window", async () => {
    renderWithQuery(<ProvidersPage />);

    const staleRow = (await screen.findByText("stale_marketplace")).closest("tr");
    expect(staleRow).not.toBeNull();
    expect(staleRow!.textContent).toContain("Retired");

    const freshRow = screen.getByText("busy_marketplace").closest("tr");
    expect(freshRow!.textContent).not.toContain("Retired");

    expect(retiredTags()).toHaveLength(1);
  });

  it("derives the headline count from the non-retired subset", async () => {
    renderWithQuery(<ProvidersPage />);

    // Three rows, one retired — the headline must say two, not three.
    expect(
      await screen.findByRole("heading", { name: /Two providers, two postures/i })
    ).toBeInTheDocument();
  });

  it("sorts retired rows below active rows", async () => {
    renderWithQuery(<ProvidersPage />);
    await screen.findByText("stale_marketplace");

    const rows = providerRows();
    expect(rows[0]).toContain("busy_marketplace");
    expect(rows[1]).toContain("small_neocloud");
    // Retired last despite having the largest offer count.
    expect(rows[2]).toContain("stale_marketplace");
  });

  it("treats a provider that has never collected as retired", async () => {
    mockedGetProviders.mockResolvedValue({
      items: [{ ...items[1] }, { ...items[0], latest_collection: null }],
    });
    renderWithQuery(<ProvidersPage />);

    await screen.findByText("stale_marketplace");
    expect(retiredTags()).toHaveLength(1);
    expect(
      screen.getByRole("heading", { name: /One provider, one posture/i })
    ).toBeInTheDocument();
  });
});
