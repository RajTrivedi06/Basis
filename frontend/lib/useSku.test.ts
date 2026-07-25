import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSku } from "@/lib/useSku";

const replace = vi.fn();

let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParams,
}));

describe("useSku", () => {
  beforeEach(() => {
    replace.mockClear();
    searchParams = new URLSearchParams();
  });

  it("defaults to h100_sxm_80gb when sku param is absent", () => {
    const { result } = renderHook(() => useSku());
    expect(result.current.sku).toBe("h100_sxm_80gb");
  });

  it("reads sku from ?sku= search param", () => {
    searchParams = new URLSearchParams("sku=a100_sxm4_80gb");
    const { result } = renderHook(() => useSku());
    expect(result.current.sku).toBe("a100_sxm4_80gb");
  });

  it("writes via router.replace and removes default sku from URL", () => {
    searchParams = new URLSearchParams("sku=a100_sxm4_80gb");
    const { result } = renderHook(() => useSku());

    result.current.setSku("h100_sxm_80gb");

    expect(replace).toHaveBeenCalledWith("?", { scroll: false });
  });

  it("writes non-default sku via router.replace", () => {
    const { result } = renderHook(() => useSku());

    result.current.setSku("h200_sxm_141gb");

    expect(replace).toHaveBeenCalledWith("?sku=h200_sxm_141gb", {
      scroll: false,
    });
  });

  it("preserves other query params when setting sku", () => {
    searchParams = new URLSearchParams("tab=dispersion");
    const { result } = renderHook(() => useSku());

    result.current.setSku("a100_sxm4_80gb");

    expect(replace).toHaveBeenCalledWith("?tab=dispersion&sku=a100_sxm4_80gb", {
      scroll: false,
    });
  });
});
