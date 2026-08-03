import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DispersionFan } from "@/app/dispersion/DispersionFan";
import {
  FactorStripPlot,
  type StripPlotPoint,
} from "@/app/basis/FactorStripPlot";
import { ResidualSeriesChart } from "@/components/charts/ResidualSeriesChart";
import { ResidualTimeSeriesChart } from "@/components/ResidualTimeSeriesChart";
import { getBasisTimeseries } from "@/lib/api";
import { factorColor } from "@/lib/factorColor";
import type { BasisDecompositionResponse } from "@/lib/types";
import { renderWithQuery } from "@/test/test-utils";

vi.mock("@/lib/api", () => ({
  getBasisTimeseries: vi.fn(),
}));

const mockedTimeseries = vi.mocked(getBasisTimeseries);

/**
 * ADR-0005 as amended 2026-08-03. Two halves of one rule, so both are pinned:
 * the accent owns single-series line and dot marks, and void keeps residual
 * SHARE encodings. A recolor that satisfies only the first half is the failure
 * mode this file exists to catch.
 */

function timeseriesPoint(
  date: string,
  pct: number
): BasisDecompositionResponse {
  return {
    date,
    gpu_sku: "h100_sxm_80gb",
    total_variance: 1,
    variance_from_region: 0,
    variance_from_commitment: 0,
    variance_from_bundle: 0,
    variance_from_provider: (100 - pct) / 100,
    residual_variance: pct / 100,
    pct_explained: 100 - pct,
    pct_residual: pct,
  };
}

const SERIES = [
  timeseriesPoint("2026-07-28", 52),
  timeseriesPoint("2026-07-29", 55),
  timeseriesPoint("2026-07-30", 48),
];

function stripPoint(
  id: number,
  price: number,
  groupKey: string
): StripPlotPoint {
  return {
    canonicalOfferId: id,
    rawObservationId: id,
    price,
    groupKey,
    groupLabel: groupKey,
    isUnknown: false,
    provider: "vast_ai",
    commitmentType: "spot",
    regionLabel: "US",
  };
}

const STRIP_POINTS = [
  stripPoint(1, 1.9, "vast_ai · spot"),
  stripPoint(2, 2.4, "vast_ai · spot"),
  stripPoint(3, 3.1, "vast_ai · spot"),
  stripPoint(4, 2.2, "runpod · spot"),
  stripPoint(5, 2.8, "runpod · spot"),
  stripPoint(6, 3.4, "runpod · spot"),
];

describe("chart-mark accent grammar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedTimeseries.mockResolvedValue({
      gpu_sku: "h100_sxm_80gb",
      points: SERIES,
    } as Awaited<ReturnType<typeof getBasisTimeseries>>);
  });

  it("draws the residual-over-time line and its dots in the accent", async () => {
    const { container } = renderWithQuery(<ResidualTimeSeriesChart />);

    await waitFor(() => {
      expect(container.querySelector("polyline")).not.toBeNull();
    });

    expect(container.querySelector("polyline")!.getAttribute("stroke")).toBe(
      "var(--accent)"
    );

    const dots = Array.from(container.querySelectorAll("circle"));
    expect(dots).toHaveLength(SERIES.length);
    for (const dot of dots) {
      expect(dot.getAttribute("fill")).toBe("var(--accent)");
    }
  });

  it("keeps the median level and the printed shares in void", async () => {
    const { container } = renderWithQuery(<ResidualTimeSeriesChart />);

    await waitFor(() => {
      expect(container.querySelector("polyline")).not.toBeNull();
    });

    const medianGroup = container.querySelector(".basis-median-line-anim")!;
    expect(medianGroup.querySelector("line")!.getAttribute("stroke")).toBe(
      "var(--residual-line)"
    );
    expect(medianGroup.querySelector("text")!.getAttribute("fill")).toBe(
      "var(--residual)"
    );
  });

  it("gives the pooled exhibit's era rules a neutral, not the mark accent", () => {
    const { container } = render(
      <ResidualSeriesChart
        points={SERIES}
        color="var(--accent)"
        ariaLabel="market-priced series"
      />
    );

    const marks = [
      container.querySelector("polyline")!.getAttribute("stroke"),
      ...Array.from(container.querySelectorAll("circle")).map((c) =>
        c.getAttribute("fill")
      ),
    ];
    expect(new Set(marks)).toEqual(new Set(["var(--accent)"]));

    // The era rules annotate the series; if they shared its color the reader
    // would have no way to tell the annotation from the data.
    const rules = Array.from(container.querySelectorAll("line")).filter(
      (line) => line.getAttribute("stroke-dasharray") === "3 3"
    );
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule.getAttribute("stroke")).not.toBe("var(--accent)");
    }
  });

  it("draws the dispersion median in the accent and leaves the band in ink", () => {
    const { container } = render(
      <DispersionFan
        title="dispersion"
        data={[
          { date: "2026-07-28", p25: 1.8, median: 2.4, p75: 3.2 },
          { date: "2026-07-29", p25: 1.9, median: 2.5, p75: 3.4 },
          { date: "2026-07-30", p25: 1.7, median: 2.2, p75: 3.0 },
        ]}
      />
    );

    const paths = Array.from(container.querySelectorAll("path"));
    const median = paths.find((p) => p.getAttribute("fill") === "none")!;
    const band = paths.find((p) => p.getAttribute("stroke") === "none")!;

    expect(median.getAttribute("stroke")).toBe("var(--accent)");
    expect(band.getAttribute("fill")).toBe("var(--ink-mid)");
  });

  it("accents the residual strip-plot dots but keeps factor views categorical", () => {
    const residual = render(
      <FactorStripPlot factor="residual" points={STRIP_POINTS} />
    );
    const residualDots = Array.from(
      residual.container.querySelectorAll("circle.basis-strip-dot")
    );
    expect(residualDots).toHaveLength(STRIP_POINTS.length);
    for (const dot of residualDots) {
      expect(dot.getAttribute("fill")).toBe("var(--accent)");
    }
    residual.unmount();

    const provider = render(
      <FactorStripPlot factor="provider" points={STRIP_POINTS} />
    );
    for (const dot of provider.container.querySelectorAll(
      "circle.basis-strip-dot"
    )) {
      expect(dot.getAttribute("fill")).toBe(factorColor("provider"));
    }
  });
});
