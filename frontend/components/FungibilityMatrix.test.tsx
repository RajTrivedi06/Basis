import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FungibilityMatrix } from "@/components/FungibilityMatrix";
import { getFungibilityMatrix } from "@/lib/api";
import { renderWithQuery } from "@/test/test-utils";

vi.mock("@/lib/api", () => ({
  getFungibilityMatrix: vi.fn(),
}));

const mockedGetFungibilityMatrix = vi.mocked(getFungibilityMatrix);

const rows = [
  {
    gpu_sku: "h100_sxm_80gb",
    latest_date: "2026-07-01",
    median_price: 2.5,
    observation_count: 100,
    provider_count: 4,
    total_variance: 1,
    residual_variance: 0.4,
    pct_residual: 40,
  },
  {
    gpu_sku: "a100_sxm4_80gb",
    latest_date: "2026-07-01",
    median_price: 1.2,
    observation_count: 80,
    provider_count: 3,
    total_variance: 1,
    residual_variance: 0.7,
    pct_residual: 70,
  },
  {
    gpu_sku: "rtx_4090_24gb",
    latest_date: "2026-07-01",
    median_price: 0.4,
    observation_count: 20,
    provider_count: 2,
    total_variance: 1,
    residual_variance: 0.2,
    pct_residual: 20,
  },
];

describe("FungibilityMatrix", () => {
  beforeEach(() => {
    mockedGetFungibilityMatrix.mockResolvedValue({ items: rows });
  });

  it("renders rows from API data", async () => {
    renderWithQuery(<FungibilityMatrix />);

    expect((await screen.findAllByText("h100_sxm_80gb")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("a100_sxm4_80gb").length).toBeGreaterThan(0);
    expect(screen.getAllByText("rtx_4090_24gb").length).toBeGreaterThan(0);
  });

  it("includes a Residual column header", async () => {
    renderWithQuery(<FungibilityMatrix />);

    expect(
      await screen.findByRole("columnheader", { name: /Residual/i })
    ).toBeInTheDocument();
  });

  it("re-sorts rows when a column header is clicked", async () => {
    const user = userEvent.setup();
    const { container } = renderWithQuery(<FungibilityMatrix />);

    await screen.findAllByText("h100_sxm_80gb");

    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    const skuHeader = within(table as HTMLElement).getByRole("columnheader", {
      name: /^SKU/,
    });
    await user.click(within(skuHeader).getByRole("button"));

    const bodyRows = screen.getAllByRole("row").slice(1);
    const firstSku = within(bodyRows[0]).getByText(/_/).textContent;
    expect(firstSku).toContain("a100_sxm4_80gb");
  });
});

describe("FungibilityMatrix — cards + pagination", () => {
  beforeEach(() => {
    mockedGetFungibilityMatrix.mockResolvedValue({ items: rows });
  });

  it("renders the card view alongside the table (CSS decides visibility)", async () => {
    const { container } = renderWithQuery(<FungibilityMatrix />);
    await screen.findByText(/ENTRIES 1–3 OF 3/);

    const cards = container.querySelectorAll(".register-card");
    expect(cards.length).toBe(rows.length);
    const first = within(cards[0] as HTMLElement);
    // Default sort is residual desc → a100 (70%) leads.
    expect(first.getByText("a100_sxm4_80gb")).toBeInTheDocument();
    expect(first.getByText("80 offers")).toBeInTheDocument();
    expect(first.getByText("$1.20/hr")).toBeInTheDocument();
    expect(first.getByText("70%")).toBeInTheDocument();
  });

  it("shows the italic accumulating state when residual is null", async () => {
    mockedGetFungibilityMatrix.mockResolvedValue({
      items: [{ ...rows[0], pct_residual: null, residual_variance: null }],
    });
    const { container } = renderWithQuery(<FungibilityMatrix />);
    await screen.findByText(/ENTRIES 1–1 OF 1/);
    expect(
      within(container.querySelector(".register-card") as HTMLElement).getByText(
        "accumulating observations"
      )
    ).toBeInTheDocument();
  });

  it("paginates past 32 rows, shows range text, and page links jump", async () => {
    const many = Array.from({ length: 70 }, (_, i) => ({
      ...rows[0],
      gpu_sku: `sku_${String(i).padStart(2, "0")}`,
      pct_residual: 99 - i,
    }));
    mockedGetFungibilityMatrix.mockResolvedValue({ items: many });
    const { container } = renderWithQuery(<FungibilityMatrix />);
    await screen.findByText("ENTRIES 1–32 OF 70");

    const links = screen.getAllByRole("button", { name: /^[0-9]+$/ });
    expect(links.map((l) => l.textContent)).toEqual(["1", "2", "3"]);
    expect(links[0].getAttribute("aria-current")).toBe("page");

    await userEvent.click(links[2]);
    expect(
      screen.getByText("ENTRIES 65–70 OF 70")
    ).toBeInTheDocument();
    // Highest residual sorts first, so page 3 holds the tail.
    expect(container.querySelectorAll(".register-card").length).toBe(6);
    expect(screen.getAllByText("sku_69").length).toBeGreaterThan(0);
  });

  it("resets to page 1 when the sort changes", async () => {
    const many = Array.from({ length: 70 }, (_, i) => ({
      ...rows[0],
      gpu_sku: `sku_${String(i).padStart(2, "0")}`,
      pct_residual: 99 - i,
    }));
    mockedGetFungibilityMatrix.mockResolvedValue({ items: many });
    renderWithQuery(<FungibilityMatrix />);
    await screen.findByText("ENTRIES 1–32 OF 70");

    await userEvent.click(screen.getByRole("button", { name: "3" }));
    await userEvent.selectOptions(
      screen.getByLabelText("Sort SKUs"),
      "gpu_sku"
    );
    expect(
      screen.getByText("ENTRIES 1–32 OF 70")
    ).toBeInTheDocument();
  });
});
