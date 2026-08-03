import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProvidersPage from "@/app/providers/page";
import { getProviders } from "@/lib/api";
import { renderWithQuery } from "@/test/test-utils";

vi.mock("@/lib/api", () => ({
  getProviders: vi.fn(),
}));

const mockedGetProviders = vi.mocked(getProviders);

const fresh = new Date().toISOString();
const items = [
  {
    provider: "vast",
    offer_count: 1000,
    distinct_skus: 78,
    latest_collection: fresh,
    median_deviation_pct: -12.4,
  },
  {
    provider: "tensordock",
    offer_count: 50,
    distinct_skus: 24,
    latest_collection: "2026-07-01T00:00:00Z",
    median_deviation_pct: 5.1,
  },
];

describe("ProvidersPage — mobile cards", () => {
  beforeEach(() => {
    mockedGetProviders.mockResolvedValue({ items });
  });

  it("renders one card per provider with delta, meta, and retired tag", async () => {
    const { container } = renderWithQuery(<ProvidersPage />);
    await screen.findAllByText("vast");

    const cards = container.querySelectorAll(".prov-card");
    expect(cards.length).toBe(2);
    const vastCard = within(cards[0] as HTMLElement);
    expect(vastCard.getByText("↓ 12.4%")).toBeInTheDocument();
    expect(vastCard.getByText("1,000 offers")).toBeInTheDocument();
    expect(vastCard.getByText("78 SKUs")).toBeInTheDocument();
    // stale > 7 days → retired tag, rule from #53
    expect(
      within(cards[1] as HTMLElement).getByText("Retired")
    ).toBeInTheDocument();
  });

  it("keeps the desktop table in the DOM (CSS decides visibility)", async () => {
    const { container } = renderWithQuery(<ProvidersPage />);
    await screen.findAllByText("vast");
    expect(container.querySelector(".prov-table table")).not.toBeNull();
  });
});
