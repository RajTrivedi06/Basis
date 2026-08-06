import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("ProvidersPage: declassified watch list", () => {
  beforeEach(() => {
    mockedGetProviders.mockResolvedValue({ items });
  });

  it("renders the C18 structural headline and sheet chrome", async () => {
    renderWithQuery(<ProvidersPage />);
    expect(
      await screen.findByRole("heading", {
        name: /one provider,\s*one posture/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/04 · Source posture/i)).toBeInTheDocument();
    expect(screen.getByText(/TOP SECRET/i)).toBeInTheDocument();
    expect(
      screen.getByText(/OVERSTAMPED: DECLASSIFIED/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/GET \/api\/providers/)).toBeInTheDocument();
  });

  it("renders one watch row per provider with delta, meta, and retired tag", async () => {
    const { container } = renderWithQuery(<ProvidersPage />);
    await screen.findByText("vast");

    const rows = container.querySelectorAll(".watch-row");
    expect(rows.length).toBe(2);

    const vastRow = within(rows[0] as HTMLElement);
    expect(vastRow.getByText("↓ 12.4%")).toBeInTheDocument();
    expect(vastRow.getByText("1,000")).toBeInTheDocument();
    expect(vastRow.getByText("78")).toBeInTheDocument();
    expect(
      vastRow.getByText(/marketplace · thousands of independent hosts/i)
    ).toBeInTheDocument();

    // stale > 7 days → retired tag, rule from #53
    expect(
      within(rows[1] as HTMLElement).getByText("RETIRED")
    ).toBeInTheDocument();
  });

  it("opens a dossier with provenance on row click", async () => {
    const user = userEvent.setup();
    const { container } = renderWithQuery(<ProvidersPage />);
    await screen.findByText("vast");

    const vastButton = container.querySelector(
      ".watch-row__main"
    ) as HTMLButtonElement;
    expect(vastButton).not.toBeNull();
    expect(vastButton.getAttribute("aria-expanded")).toBe("false");

    await user.click(vastButton);
    expect(vastButton.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/DOSSIER · OBSERVED CONDUCT/i)).toBeInTheDocument();
    expect(screen.getByText(/FILE No\. BS-04-VAST/i)).toBeInTheDocument();
    expect(screen.getByText(/FIELD: median_deviation_pct/i)).toBeInTheDocument();
  });

  it("reveals the Δ computation layer on demand", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ProvidersPage />);
    await screen.findByText("vast");

    const toggle = screen.getByRole("button", {
      name: /show me how Δ vs market is computed/i,
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(
      screen.getByText(/posture, not a verdict/i)
    ).toBeInTheDocument();
  });
});
