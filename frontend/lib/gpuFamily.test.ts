import { describe, expect, it } from "vitest";
import { gpuFamily } from "@/lib/gpuFamily";

describe("gpuFamily", () => {
  const cases: [string, string | null][] = [
    ["h100_sxm_80gb", "Hopper"],
    ["h200_sxm_141gb", "Hopper"],
    ["b200_sxm_180gb", "Blackwell"],
    ["b300_sxm", "Blackwell"],
    ["a100_sxm4_80gb", "Ampere"],
    ["a800_pcie_80gb", "Ampere"],
    ["a40_48gb", "Ampere"],
    ["a10_24gb", "Ampere"],
    ["l40s_48gb", "Ada"],
    ["l4_24gb", "Ada"],
    ["rtx_6000ada_48gb", "Ada"],
    ["rtx_pro_6000", "Blackwell"],
    ["rtx_a6000", "Workstation"],
    ["rtx_4090_24gb", "Consumer"],
    ["rtx_3090_24gb", "Consumer"],
    ["gtx_1080ti", "Legacy"],
    ["quadro_rtx_8000", "Workstation"],
    ["v100_sxm2_32gb", "Volta"],
    ["t4_16gb", "Legacy"],
    ["mi300x_192gb", "AMD"],
    ["totally_unknown_sku", null],
    ["", null],
  ];

  it.each(cases)("maps %s to %s", (sku, expected) => {
    expect(gpuFamily(sku)).toBe(expected);
  });

  it("returns null rather than guessing for unknown prefixes", () => {
    expect(gpuFamily("mystery_gpu_xyz")).toBeNull();
    expect(gpuFamily("nvidia_unknown")).toBeNull();
  });
});
