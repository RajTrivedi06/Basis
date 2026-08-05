import { describe, expect, it } from "vitest";
import {
  axisBounds,
  axisTicks,
  buildQuoteExhibit,
  commitmentLabel,
  footageLabel,
  hashUnit,
  logPosition,
  multipleWord,
  regionLabel,
} from "@/lib/fileCopy";
import type { OfferSummary } from "@/lib/types";

function offer(over: Partial<OfferSummary> & { id: number }): OfferSummary {
  return {
    collected_at: "2026-08-04T20:04:00Z",
    gpu_sku: "h100_sxm_80gb",
    provider: "vast",
    region_country: "US",
    commitment_type: "on_demand",
    price_usd_per_hour: 2,
    normalized_price_usd_per_hour: null,
    ...over,
  };
}

describe("multipleWord", () => {
  it("spells the spread so the hook reads as a sentence", () => {
    expect(multipleWord(15.3)).toBe("fifteen");
    expect(multipleWord(4)).toBe("four");
  });

  it("falls back to digits outside the spelled range", () => {
    expect(multipleWord(24.4)).toBe("24");
    expect(multipleWord(1.4)).toBe("1.4");
  });

  it("returns empty for a multiple that cannot be stated", () => {
    expect(multipleWord(0)).toBe("");
    expect(multipleWord(Number.NaN)).toBe("");
  });
});

describe("hashUnit", () => {
  it("is deterministic, so server HTML and hydration agree", () => {
    expect(hashUnit(603411)).toBe(hashUnit(603411));
  });

  it("stays inside the lane", () => {
    for (const id of [0, 1, 7, 4096, 603411, -12]) {
      const v = hashUnit(id);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("spreads neighbouring ids apart", () => {
    const a = hashUnit(1000);
    const b = hashUnit(1001);
    expect(Math.abs(a - b)).toBeGreaterThan(0.02);
  });
});

describe("logPosition", () => {
  it("places the bounds at the ends and the geometric mean in the middle", () => {
    expect(logPosition(0.5, 0.5, 8)).toBe(0);
    expect(logPosition(8, 0.5, 8)).toBe(1);
    expect(logPosition(2, 0.5, 8)).toBeCloseTo(0.5, 6);
  });

  it("refuses impossible axes instead of producing NaN", () => {
    expect(logPosition(0, 0.5, 8)).toBe(0);
    expect(logPosition(2, 0, 8)).toBe(0);
    expect(logPosition(2, 8, 8)).toBe(0);
  });
});

describe("axisBounds and axisTicks", () => {
  it("snaps outside the data", () => {
    const bounds = axisBounds([0.45, 1.2, 6.88]);
    expect(bounds).not.toBeNull();
    expect(bounds!.lo).toBeLessThanOrEqual(0.45);
    expect(bounds!.hi).toBeGreaterThanOrEqual(6.88);
  });

  it("has no bounds without positive prices", () => {
    expect(axisBounds([])).toBeNull();
    expect(axisBounds([0, -3])).toBeNull();
  });

  it("keeps ticks inside the axis and never more than four", () => {
    const ticks = axisTicks(0.4, 8);
    expect(ticks.length).toBeLessThanOrEqual(4);
    ticks.forEach((t) => {
      expect(t).toBeGreaterThan(0.4);
      expect(t).toBeLessThan(8);
    });
  });
});

describe("buildQuoteExhibit", () => {
  const day = "2026-08-04T20:04:00Z";
  const many = (n: number, over: Partial<OfferSummary> = {}) =>
    Array.from({ length: n }, (_, i) =>
      offer({ id: 1000 + i, collected_at: day, ...over })
    );

  it("returns null below the minimum sample, rather than a thin exhibit", () => {
    expect(buildQuoteExhibit(many(4))).toBeNull();
    expect(buildQuoteExhibit([])).toBeNull();
  });

  it("keeps only the newest collection day", () => {
    const exhibit = buildQuoteExhibit([
      ...many(14),
      offer({ id: 1, collected_at: "2026-07-01T08:00:00Z", price_usd_per_hour: 99 }),
    ]);
    expect(exhibit).not.toBeNull();
    expect(exhibit!.day).toBe("2026-08-04");
    expect(exhibit!.total).toBe(14);
    expect(exhibit!.lanes.flatMap((l) => l.dots).some((d) => d.price === 99)).toBe(
      false
    );
  });

  it("orders lanes by their own median price", () => {
    const exhibit = buildQuoteExhibit([
      ...many(6, { provider: "azure", price_usd_per_hour: 6 }),
      ...many(6, { provider: "vast", price_usd_per_hour: 1 }).map((o, i) => ({
        ...o,
        id: 5000 + i,
      })),
    ]);
    expect(exhibit).not.toBeNull();
    expect(exhibit!.lanes.map((l) => l.provider)).toEqual(["vast", "azure"]);
  });

  it("reports the day's recorded total when the page truncates it", () => {
    const plotted = buildQuoteExhibit(many(14), 900);
    expect(plotted!.total).toBe(14);
    expect(plotted!.recorded).toBe(900);
    // A total at or below what we plotted is not a truncation.
    expect(buildQuoteExhibit(many(14), 14)!.recorded).toBe(14);
    expect(buildQuoteExhibit(many(14), null)!.recorded).toBe(14);
  });

  it("prefers the normalized price and drops unpriced rows", () => {
    const exhibit = buildQuoteExhibit([
      ...many(13),
      offer({
        id: 9001,
        collected_at: day,
        price_usd_per_hour: 10,
        normalized_price_usd_per_hour: 3,
      }),
      offer({ id: 9002, collected_at: day, price_usd_per_hour: 0 }),
    ]);
    expect(exhibit).not.toBeNull();
    expect(exhibit!.total).toBe(14);
    const prices = exhibit!.lanes.flatMap((l) => l.dots).map((d) => d.price);
    expect(prices).toContain(3);
    expect(prices).not.toContain(10);
  });
});

describe("labels", () => {
  it("counts footage across the reel", () => {
    expect(footageLabel(0)).toBe("0000");
    expect(footageLabel(1)).toBe("1187");
    expect(footageLabel(0.5)).toBe("0594");
  });

  it("keeps a missing region visibly unknown", () => {
    expect(regionLabel(null)).toBe("UNKNOWN");
    expect(regionLabel("  ")).toBe("UNKNOWN");
    expect(regionLabel("US")).toBe("US");
  });

  it("reads commitments as prose", () => {
    expect(commitmentLabel("on_demand")).toBe("on demand");
    expect(commitmentLabel("reserved_3y")).toBe("reserved 3y");
  });
});
