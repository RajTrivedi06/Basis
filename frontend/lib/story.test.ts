import { describe, expect, it } from "vitest";
import { computeHeroBounds } from "@/lib/story";
import type { OfferListResponse, OfferSummary } from "@/lib/types";

function offer(
  id: number,
  provider: string,
  price: number
): OfferSummary {
  return {
    id,
    collected_at: "2026-08-05T08:04:00Z",
    gpu_sku: "h100_sxm_80gb",
    provider,
    region_country: "US",
    commitment_type: "on_demand",
    price_usd_per_hour: price,
    normalized_price_usd_per_hour: null,
  };
}

function response(items: OfferSummary[]): OfferListResponse {
  return { items, total: items.length, page: 1, page_size: 500 };
}

/** 20 rows is the floor below which the quantiles are refused. */
function ramp(provider: string, from: number, to: number, n: number, idFrom = 0) {
  return Array.from({ length: n }, (_, i) =>
    offer(idFrom + i, provider, from + ((to - from) * i) / (n - 1))
  );
}

describe("computeHeroBounds", () => {
  it("refuses to quote bounds on a thin sample", () => {
    expect(computeHeroBounds(response(ramp("vast", 1, 5, 12)))).toBeNull();
    expect(computeHeroBounds(null)).toBeNull();
    expect(computeHeroBounds(response([]))).toBeNull();
  });

  it("prefers a different seller for the dear end", () => {
    const bounds = computeHeroBounds(
      response([
        ...ramp("vast", 0.5, 3, 20, 100),
        ...ramp("azure", 3, 12, 20, 200),
      ])
    );
    expect(bounds).not.toBeNull();
    expect(bounds!.lowOffer.provider).toBe("vast");
    expect(bounds!.highOffer.provider).toBe("azure");
    expect(bounds!.crossProvider).toBe(true);
  });

  it("keeps the true nearest offer when no other seller is near p95", () => {
    // Everything expensive belongs to one seller; the cheap seller tops out
    // an order of magnitude below p95, well outside the tolerance.
    const bounds = computeHeroBounds(
      response([...ramp("vast", 0.4, 0.6, 20, 100), ...ramp("gcp", 5, 40, 20, 200)])
    );
    expect(bounds).not.toBeNull();
    expect(bounds!.crossProvider).toBe(true);
    expect(bounds!.highOffer.provider).toBe("gcp");
  });

  it("reports a single-seller spread honestly", () => {
    const bounds = computeHeroBounds(response(ramp("gcp", 1, 15, 40)));
    expect(bounds).not.toBeNull();
    expect(bounds!.crossProvider).toBe(false);
    expect(bounds!.lowOffer.provider).toBe("gcp");
    expect(bounds!.highOffer.provider).toBe("gcp");
  });

  it("quotes p5/p95 rather than the extremes", () => {
    const bounds = computeHeroBounds(
      response([
        offer(1, "vast", 0.01), // a junk listing at each end
        ...ramp("vast", 1, 3, 30, 100),
        offer(2, "azure", 900),
      ])
    );
    expect(bounds).not.toBeNull();
    expect(bounds!.low).toBeGreaterThan(0.01);
    expect(bounds!.high).toBeLessThan(900);
    expect(bounds!.multiple).toBeLessThan(20);
  });

  it("counts the sample it quoted", () => {
    const bounds = computeHeroBounds(response(ramp("vast", 1, 9, 33)));
    expect(bounds!.sampleSize).toBe(33);
  });

  it("keeps low and high offers on the same commitment type", () => {
    const bounds = computeHeroBounds(
      response([
        ...ramp("vast", 0.5, 2, 20, 100).map((o) => ({
          ...o,
          commitment_type: "spot",
        })),
        ...ramp("azure", 2, 14, 20, 200).map((o) => ({
          ...o,
          commitment_type: "reserved_1y",
        })),
        ...ramp("runpod", 0.4, 1.8, 20, 300).map((o) => ({
          ...o,
          commitment_type: "on_demand",
        })),
      ])
    );
    expect(bounds).not.toBeNull();
    expect(bounds!.lowOffer.commitment).toBe(bounds!.highOffer.commitment);
  });

  it("prefers a commitment pool with a cross-provider spread", () => {
    const bounds = computeHeroBounds(
      response([
        ...ramp("vast", 1, 2, 20, 100).map((o) => ({
          ...o,
          commitment_type: "on_demand",
        })),
        ...ramp("runpod", 2, 12, 20, 200).map((o) => ({
          ...o,
          commitment_type: "on_demand",
        })),
        ...ramp("azure", 0.2, 0.4, 25, 300).map((o) => ({
          ...o,
          commitment_type: "spot",
        })),
      ])
    );
    expect(bounds).not.toBeNull();
    expect(bounds!.lowOffer.commitment).toBe("on_demand");
    expect(bounds!.highOffer.commitment).toBe("on_demand");
    expect(bounds!.crossProvider).toBe(true);
  });
});
