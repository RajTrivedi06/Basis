import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SkuPicker } from "@/components/SkuPicker";
import { getGpuSkus } from "@/lib/api";
import { renderWithQuery } from "@/test/test-utils";

vi.mock("@/lib/api", () => ({
  getGpuSkus: vi.fn(),
}));

const mockedGetGpuSkus = vi.mocked(getGpuSkus);

describe("SkuPicker", () => {
  const onChange = vi.fn();

  beforeEach(() => {
    onChange.mockClear();
    mockedGetGpuSkus.mockResolvedValue({
      items: [
        {
          gpu_sku: "a100_sxm4_80gb",
          gpu_variant: null,
          vram_gb: 80,
          offer_count: 42,
          provider_count: 3,
          latest_median_price: 1.5,
        },
        {
          gpu_sku: "h100_sxm_80gb",
          gpu_variant: null,
          vram_gb: 80,
          offer_count: 120,
          provider_count: 4,
          latest_median_price: 2.8,
        },
        {
          gpu_sku: "rtx_4090_24gb",
          gpu_variant: null,
          vram_gb: 24,
          offer_count: 15,
          provider_count: 2,
          latest_median_price: 0.45,
        },
      ],
    });
  });

  it("renders options sorted by offer_count desc", async () => {
    renderWithQuery(
      <SkuPicker value="h100_sxm_80gb" onChange={onChange} />
    );

    const select = await screen.findByRole("combobox");
    await waitFor(() => {
      expect(select).not.toBeDisabled();
    });

    const options = Array.from(select.querySelectorAll("option")).map(
      (option) => option.textContent
    );

    expect(options[0]).toContain("h100_sxm_80gb");
    expect(options[1]).toContain("a100_sxm4_80gb");
    expect(options[2]).toContain("rtx_4090_24gb");
  });

  it("fires onChange when a new SKU is selected", async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <SkuPicker value="h100_sxm_80gb" onChange={onChange} />
    );

    const select = await screen.findByRole("combobox");
    await waitFor(() => {
      expect(select).not.toBeDisabled();
    });
    await user.selectOptions(select, "a100_sxm4_80gb");

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("a100_sxm4_80gb");
    });
  });
});
