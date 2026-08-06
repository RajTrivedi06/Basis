import { describe, expect, it } from "vitest";
import { buildLedger, formatShare, rowProgress } from "@/lib/ledger";

/** A decomposition whose factor variances and residual close on the total. */
const live = {
  date: "2026-08-02",
  gpu_sku: "h100_sxm_80gb",
  total_variance: 1,
  variance_from_region: 0.048,
  variance_from_commitment: 0.069,
  variance_from_bundle: 0.083,
  variance_from_provider: 0.187,
  residual_variance: 0.613,
  pct_explained: 38.7,
  pct_residual: 61.3,
};

describe("buildLedger: factor discovery", () => {
  it("orders rows by the model's sequential-ANOVA order, not response key order", () => {
    // The API declares bundle before provider; the model attributes provider first.
    const { rows } = buildLedger(live);
    expect(rows.map((row) => row.key)).toEqual([
      "region",
      "commitment",
      "provider",
      "bundle",
    ]);
  });

  it("renders as many rows as the response carries: no fixed factor count", () => {
    expect(buildLedger(live).rows).toHaveLength(4);

    const withFifth = buildLedger({
      total_variance: 1,
      variance_from_region: 0.1,
      variance_from_commitment: 0.1,
      variance_from_provider: 0.1,
      variance_from_bundle: 0.1,
      variance_from_host_class: 0.2,
      residual_variance: 0.4,
    });
    expect(withFifth.rows).toHaveLength(5);
    // An unfamiliar factor is shown, and lands after the factors we know.
    expect(withFifth.rows[4].key).toBe("host_class");
    expect(withFifth.rows[4].tag).toBe("HOST CLASS");
    expect(withFifth.rows[4].phrase).toBeNull();

    const withThree = buildLedger({
      total_variance: 1,
      variance_from_region: 0.2,
      variance_from_commitment: 0.2,
      variance_from_provider: 0.2,
      residual_variance: 0.4,
    });
    expect(withThree.rows).toHaveLength(3);
    expect(withThree.residualShare).toBeCloseTo(0.4, 10);
  });

  it("colors known factors from their tokens and unknown ones neutrally", () => {
    const { rows } = buildLedger({
      total_variance: 1,
      variance_from_region: 0.1,
      variance_from_host_class: 0.1,
      residual_variance: 0.8,
    });
    expect(rows[0].color).toBe("var(--factor-region)");
    expect(rows[1].color).toBe("var(--unknown)");
  });
});

describe("buildLedger: the 'X left' column", () => {
  it("starts at 100% and subtracts each factor in turn", () => {
    const { rows } = buildLedger(live);

    expect(rows[0].before).toBeCloseTo(1, 10);
    expect(rows.map((row) => formatShare(row.after))).toEqual([
      "95.2",
      "88.3",
      "69.6",
      "61.3",
    ]);
  });

  it("hands each row the remainder the previous row left", () => {
    const { rows } = buildLedger(live);
    rows.forEach((row, index) => {
      const expected = index === 0 ? 1 : rows[index - 1].after;
      expect(row.before).toBeCloseTo(expected, 10);
      expect(row.after).toBeCloseTo(row.before - row.share, 10);
    });
  });

  it("closes on the residual the API reports", () => {
    const { rows, residualShare } = buildLedger(live);
    expect(rows[rows.length - 1].after).toBeCloseTo(residualShare, 10);
    expect(formatShare(residualShare)).toBe(live.pct_residual.toFixed(1));
  });

  it("computes shares against total_variance rather than assuming it is 1", () => {
    const scaled = buildLedger({
      total_variance: 0.4,
      variance_from_region: 0.04,
      variance_from_commitment: 0.04,
      variance_from_provider: 0.04,
      variance_from_bundle: 0.04,
      residual_variance: 0.24,
    });
    expect(scaled.rows.map((row) => formatShare(row.share))).toEqual([
      "10.0",
      "10.0",
      "10.0",
      "10.0",
    ]);
    expect(formatShare(scaled.residualShare)).toBe("60.0");
  });

  it("degrades to zeros rather than NaN when there is no variance to divide by", () => {
    const empty = buildLedger({
      total_variance: 0,
      variance_from_region: 0,
      residual_variance: 0,
    });
    expect(empty.rows[0].share).toBe(0);
    expect(empty.rows[0].after).toBe(1);
    expect(Number.isFinite(empty.residualShare)).toBe(true);
  });
});

describe("rowProgress", () => {
  it("renders every row finished when no scrub is supplied", () => {
    expect(rowProgress(undefined, 0, 5)).toBe(1);
    expect(rowProgress(undefined, 4, 5)).toBe(1);
  });

  it("advances one row at a time under a global scrub", () => {
    // Five steps: four factor rows, then the void block.
    expect(rowProgress(0, 0, 5)).toBe(0);
    expect(rowProgress(0.1, 0, 5)).toBeCloseTo(0.5, 10);
    expect(rowProgress(0.2, 0, 5)).toBe(1);
    expect(rowProgress(0.2, 1, 5)).toBe(0);
    expect(rowProgress(1, 4, 5)).toBe(1);
  });

  it("takes per-row values from an array and treats missing entries as unstarted", () => {
    expect(rowProgress([0.25, 1], 0, 2)).toBe(0.25);
    expect(rowProgress([0.25, 1], 1, 2)).toBe(1);
    expect(rowProgress([0.25], 1, 2)).toBe(0);
  });
});
