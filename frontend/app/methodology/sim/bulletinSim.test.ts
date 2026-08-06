import { describe, expect, it } from "vitest";
import {
  DEFAULT_ORDER,
  anova,
  buildBulletinView,
  genOffers,
  moveFactor,
  type FactorKey,
} from "./bulletinSim";

describe("bulletinSim", () => {
  it("keeps residual invariant under factor reorder", () => {
    const offers = genOffers("h100_sxm_80gb").filter(
      (o) => o.provider !== "azure" && o.provider !== "gcp",
    );
    const base = anova(offers, DEFAULT_ORDER);
    const flipped: FactorKey[] = [
      "bundle",
      "provider",
      "commitment",
      "region",
    ];
    const other = anova(offers, flipped);
    expect(other.residual).toBeCloseTo(base.residual, 10);
    expect(Object.values(other.shares).reduce((a, b) => a + b, 0)).toBeCloseTo(
      Object.values(base.shares).reduce((a, b) => a + b, 0),
      10,
    );
  });

  it("moveFactor swaps neighbors and clamps ends", () => {
    const o = DEFAULT_ORDER;
    expect(moveFactor(o, 0, -1)).toEqual(o);
    expect(moveFactor(o, 3, 1)).toEqual(o);
    expect(moveFactor(o, 1, -1)).toEqual([
      "commitment",
      "region",
      "provider",
      "bundle",
    ]);
  });

  it("buildBulletinView marks simulated residual and series", () => {
    const v = buildBulletinView("h100_sxm_80gb", DEFAULT_ORDER, false);
    expect(v.n).toBeGreaterThan(50);
    expect(Number(v.residPct)).toBeGreaterThan(0);
    expect(v.seriesPath.startsWith("M")).toBe(true);
    expect(v.popTitle).toMatch(/MARKET-PRICED/);
    const pooled = buildBulletinView("h100_sxm_80gb", DEFAULT_ORDER, true);
    expect(pooled.popTitle).toMatch(/POOLED/);
  });
});
