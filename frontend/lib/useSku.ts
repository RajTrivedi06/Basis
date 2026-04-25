"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const DEFAULT_SKU = "h100_sxm_80gb";

/**
 * Read/write the current SKU via the `sku` URL search param.
 *
 * Lets SKU selection survive page refresh, be shareable via link, and
 * remain consistent when navigating between pages. `setSku` uses
 * `router.replace` so selections don't pile up in history.
 *
 * Default: h100_sxm_80gb (the thesis's anchor SKU).
 */
export function useSku(): { sku: string; setSku: (next: string) => void } {
  const params = useSearchParams();
  const router = useRouter();
  const sku = params.get("sku") ?? DEFAULT_SKU;

  const setSku = useCallback(
    (next: string) => {
      const q = new URLSearchParams(params.toString());
      if (next === DEFAULT_SKU) {
        q.delete("sku");
      } else {
        q.set("sku", next);
      }
      const qs = q.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [params, router]
  );

  return { sku, setSku };
}
