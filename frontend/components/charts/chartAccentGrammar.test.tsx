import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DispersionBand } from "@/app/dispersion/DispersionBand";
import { BeeswarmReceipt } from "@/app/basis/BeeswarmReceipt";
import type { SwarmPoint } from "@/app/basis/factorPoints";
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

function swarmPoint(
  id: number,
  price: number,
  groupKey: string
): SwarmPoint {
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

const SWARM_POINTS = [
  swarmPoint(1, 1.9, "vast_ai · spot"),
  swarmPoint(2, 2.4, "vast_ai · spot"),
  swarmPoint(3, 3.1, "vast_ai · spot"),
  swarmPoint(4, 2.2, "runpod · spot"),
  swarmPoint(5, 2.8, "runpod · spot"),
  swarmPoint(6, 3.4, "runpod · spot"),
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

  /**
   * Amended by the 2026-08-03 Director pick: the dispersion band is approved
   * *as shown* in `Basis_Explorations_dc.html` (1f), which fills it warm —
   * "the band is the finding, it should never read as fog." The band and its
   * p25/p75 hairlines join the median on the accent. What has not moved is the
   * half of ADR-0005 that matters: nothing in this chart is a residual share,
   * so void must appear nowhere in it.
   */
  it("draws the dispersion band, its edges, and the median in the accent", () => {
    const { container } = render(
      <DispersionBand
        title="dispersion"
        data={[
          { date: "2026-07-28", p25: 1.8, median: 2.4, p75: 3.2 },
          { date: "2026-07-29", p25: 1.9, median: 2.5, p75: 3.4 },
          { date: "2026-07-30", p25: 1.7, median: 2.2, p75: 3.0 },
        ]}
      />
    );

    const band = container.querySelector(".dispersion-band__fill")!;
    expect(band.getAttribute("fill")).toBe("var(--accent)");

    const edges = Array.from(container.querySelectorAll(".dispersion-band__edge"));
    expect(edges).toHaveLength(2);
    for (const edge of edges) {
      expect(edge.getAttribute("stroke")).toBe("var(--accent)");
      // Subordinate to the median, or the band reads as three equal series.
      expect(Number(edge.getAttribute("stroke-opacity"))).toBeLessThan(1);
    }

    const median = container.querySelector(".dispersion-band__median")!;
    expect(median.getAttribute("stroke")).toBe("var(--accent)");
    // The grammar cares that the median leads the band, not about the exact
    // weight: pinning the literal broke on a cosmetic redesign tweak.
    const medianWidth = Number(median.getAttribute("stroke-width"));
    const edgeWidth = Number(edges[0].getAttribute("stroke-width") ?? 1);
    expect(medianWidth).toBeGreaterThanOrEqual(edgeWidth);
    expect(medianWidth).toBeGreaterThan(1);
  });

  it("keeps void out of the dispersion band: nothing here is a residual share", () => {
    const { container } = render(
      <DispersionBand
        title="dispersion"
        data={[
          { date: "2026-07-28", p25: 1.8, median: 2.4, p75: 3.2 },
          { date: "2026-07-29", p25: 1.9, median: 2.5, p75: 3.4 },
        ]}
      />
    );

    expect(container.innerHTML).not.toContain("var(--residual");
  });

  it("accents the residual swarm dots but keeps factor views categorical", () => {
    const residual = render(
      <BeeswarmReceipt
        factor="residual"
        points={SWARM_POINTS}
        gpuSku="h100_sxm_80gb"
        onInspect={() => {}}
      />
    );
    const residualDots = Array.from(
      residual.container.querySelectorAll("circle.swarm__dot")
    );
    expect(residualDots).toHaveLength(SWARM_POINTS.length);
    for (const dot of residualDots) {
      expect(dot.getAttribute("fill")).toBe("var(--accent)");
    }
    residual.unmount();

    const provider = render(
      <BeeswarmReceipt
        factor="provider"
        points={SWARM_POINTS}
        gpuSku="h100_sxm_80gb"
        onInspect={() => {}}
      />
    );
    for (const dot of provider.container.querySelectorAll("circle.swarm__dot")) {
      expect(dot.getAttribute("fill")).toBe(factorColor("provider"));
    }
  });
});
