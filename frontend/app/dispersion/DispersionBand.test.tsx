import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  DispersionBand,
  type DispersionBandPoint,
} from "@/app/dispersion/DispersionBand";

/** A deliberately jagged series — reversals, a spike, and a collapse. */
const jagged: DispersionBandPoint[] = [
  { date: "2026-07-24", p25: 1.8, median: 2.4, p75: 3.2 },
  { date: "2026-07-25", p25: 1.2, median: 3.9, p75: 6.1 },
  { date: "2026-07-26", p25: 2.4, median: 2.5, p75: 2.6 },
  { date: "2026-07-27", p25: 0.9, median: 3.1, p75: 5.4 },
  { date: "2026-07-28", p25: 2.0, median: 2.2, p75: 3.0 },
];

function paths(container: HTMLElement, selector: string) {
  return Array.from(container.querySelectorAll(selector)).map(
    (node) => node.getAttribute("d") ?? ""
  );
}

/**
 * jsdom's PointerEvent drops coordinates, so the pointer is simulated with a
 * MouseEvent carrying the pointer type — which is what React delegates on.
 */
function pointAt(plate: Element, clientX: number) {
  plate.getBoundingClientRect = () => ({ left: 0, width: 1000 }) as DOMRect;
  fireEvent(
    plate,
    new MouseEvent("pointermove", { clientX, bubbles: true })
  );
}

describe("DispersionBand — the no-smoothing rider", () => {
  it("draws straight segments only: no curve commands anywhere", () => {
    const { container } = render(
      <DispersionBand data={jagged} title="dispersion" />
    );

    const all = [
      ...paths(container, ".dispersion-band__median"),
      ...paths(container, ".dispersion-band__edge"),
      ...paths(container, ".dispersion-band__fill"),
    ];
    expect(all.length).toBeGreaterThan(0);

    for (const d of all) {
      // C/S/Q/T/A are every curve and arc command SVG has.
      expect(d).not.toMatch(/[CSQTAcsqta]/);
      expect(d).toMatch(/^M[\d.\s]+(L[\d.\s]+)+Z?$/);
    }
  });

  it("puts a vertex on every real day — none dropped, none invented", () => {
    const { container } = render(
      <DispersionBand data={jagged} title="dispersion" />
    );

    const median = paths(container, ".dispersion-band__median")[0];
    expect(median.match(/[ML]/g)).toHaveLength(jagged.length);

    // The band walks up the p75 edge and back down the p25 edge.
    const band = paths(container, ".dispersion-band__fill")[0];
    expect(band.match(/[ML]/g)).toHaveLength(jagged.length * 2);
  });

  it("keeps the series' reversals rather than flattening them", () => {
    const { container } = render(
      <DispersionBand data={jagged} title="dispersion" />
    );

    const ys = paths(container, ".dispersion-band__median")[0]
      .split(/[ML]/)
      .filter(Boolean)
      .map((pair) => Number(pair.trim().split(/\s+/)[1]));

    // Screen y is inverted, so a rising median is a falling y. The mock's
    // smooth curve would have removed these direction changes.
    const directions = ys
      .slice(1)
      .map((y, i) => Math.sign(y - ys[i]))
      .filter((d) => d !== 0);
    const reversals = directions.filter((d, i) => i > 0 && d !== directions[i - 1]);
    expect(reversals.length).toBeGreaterThanOrEqual(2);
  });
});

describe("DispersionBand — crosshair and readout", () => {
  it("reads out the latest day until the pointer says otherwise", () => {
    const { container } = render(
      <DispersionBand data={jagged} title="dispersion" />
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "LATEST · JUL 28 · P25 $2.00 · MED $2.20 · P75 $3.00"
    );
    expect(container.querySelector(".dispersion-band__crosshair")).toBeNull();
  });

  it("follows the pointer and reports that day's three figures", () => {
    const { container } = render(
      <DispersionBand data={jagged} title="dispersion" />
    );
    const plate = container.querySelector(".dispersion-band__plate")!;

    // Plot runs from x=52 to x=852; the second of five days sits at x=252.
    pointAt(plate, 252);

    expect(screen.getByRole("status")).toHaveTextContent(
      "ENTRY · JUL 25 · P25 $1.20 · MED $3.90 · P75 $6.10"
    );
    expect(screen.getByRole("status")).not.toHaveTextContent("LATEST");
    expect(container.querySelector(".dispersion-band__crosshair")).not.toBeNull();
  });

  it("drops the crosshair when the pointer leaves", () => {
    const { container } = render(
      <DispersionBand data={jagged} title="dispersion" />
    );
    const plate = container.querySelector(".dispersion-band__plate")!;

    pointAt(plate, 252);
    expect(container.querySelector(".dispersion-band__crosshair")).not.toBeNull();

    fireEvent.pointerLeave(plate);
    expect(container.querySelector(".dispersion-band__crosshair")).toBeNull();
  });

  it("is reachable by keyboard as well as by touch", () => {
    const { container } = render(
      <DispersionBand data={jagged} title="dispersion" />
    );
    const plate = container.querySelector(".dispersion-band__plate")!;
    expect(plate.getAttribute("tabindex")).toBe("0");

    fireEvent.keyDown(plate, { key: "ArrowLeft" });
    expect(screen.getByRole("status")).toHaveTextContent("JUL 27");

    fireEvent.keyDown(plate, { key: "ArrowRight" });
    expect(screen.getByRole("status")).toHaveTextContent("JUL 28");
  });

  it("reads dates as written rather than as instants", () => {
    render(
      <DispersionBand
        data={[{ date: "2026-01-01", p25: 1, median: 2, p75: 3 }]}
        title="dispersion"
      />
    );
    // A timezone-naive parse would render this as DEC 31 west of UTC.
    expect(screen.getByRole("status")).toHaveTextContent("JAN 1");
  });
});

describe("DispersionBand — today's disagreement", () => {
  it("brackets the latest day's p25–p75 spread and labels the delta", () => {
    const { container } = render(
      <DispersionBand data={jagged} title="dispersion" />
    );

    expect(container.querySelector(".bracket-mark")).not.toBeNull();
    expect(screen.getByText("DISAGREEMENT")).toBeInTheDocument();
    // Latest day: 3.00 − 2.00.
    expect(screen.getByText("Δ $1.00")).toBeInTheDocument();
  });

  it("brackets the spread in ink — a price gap is not a residual share", () => {
    const { container } = render(
      <DispersionBand data={jagged} title="dispersion" />
    );

    const spine = container.querySelector(".bracket-mark__spine")!;
    expect(spine.getAttribute("stroke")).toBe("var(--ink)");
  });

  it("still plots and brackets a single-day series", () => {
    const { container } = render(
      <DispersionBand
        data={[{ date: "2026-07-28", p25: 1.5, median: 2.1, p75: 3.4 }]}
        title="dispersion"
      />
    );

    expect(container.querySelector(".dispersion-band__fill")).not.toBeNull();
    expect(container.querySelector(".dispersion-band__median")).not.toBeNull();
    expect(screen.getByText("Δ $1.90")).toBeInTheDocument();
  });

  it("files the plot as an observation sheet", () => {
    const { container } = render(
      <DispersionBand data={jagged} title="dispersion" />
    );
    expect(container.querySelector(".obs-sheet")).not.toBeNull();
    expect(
      screen.getByText(/OBSERVATION SHEET · POOLED ACROSS PROVIDERS/i)
    ).toBeInTheDocument();
  });
});
