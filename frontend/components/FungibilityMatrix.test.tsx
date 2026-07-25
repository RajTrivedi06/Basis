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

    expect(await screen.findByText("h100_sxm_80gb")).toBeInTheDocument();
    expect(screen.getByText("a100_sxm4_80gb")).toBeInTheDocument();
    expect(screen.getByText("rtx_4090_24gb")).toBeInTheDocument();
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

    await screen.findByText("h100_sxm_80gb");

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
