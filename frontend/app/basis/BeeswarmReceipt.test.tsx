import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BeeswarmReceipt } from "@/app/basis/BeeswarmReceipt";
import { pointsFromObservations, type SwarmPoint } from "@/app/basis/factorPoints";
import type { DecompositionObservation } from "@/lib/types";

function point(
  id: number,
  price: number,
  groupKey: string,
  overrides: Partial<SwarmPoint> = {}
): SwarmPoint {
  return {
    canonicalOfferId: id,
    rawObservationId: id + 1000,
    price,
    groupKey,
    groupLabel: groupKey,
    isUnknown: false,
    provider: "runpod",
    commitmentType: "on-demand",
    regionLabel: "US",
    ...overrides,
  };
}

const POINTS: SwarmPoint[] = [
  point(1, 1.94, "runpod"),
  point(2, 2.41, "runpod"),
  point(3, 3.15, "runpod"),
  point(4, 2.2, "vast_ai", { provider: "vast_ai" }),
  point(5, 2.85, "vast_ai", { provider: "vast_ai" }),
];

function renderSwarm(props: Partial<Parameters<typeof BeeswarmReceipt>[0]> = {}) {
  return render(
    <BeeswarmReceipt
      factor="provider"
      points={POINTS}
      gpuSku="h100_sxm_80gb"
      onInspect={() => {}}
      {...props}
    />
  );
}

/** Where the dot for a given offer was placed on the plate. */
function dotAt(container: HTMLElement, offerIndex: number) {
  const dot = container.querySelectorAll("circle.swarm__dot")[offerIndex];
  return {
    x: Number(dot.getAttribute("cx")),
    y: Number(dot.getAttribute("cy")),
  };
}

/** The plate is measured in CSS pixels, so a tap is just a client coordinate. */
function tapAt(x: number, y: number) {
  const layer = screen.getByTestId("swarm-hit-layer");
  layer.getBoundingClientRect = () => ({ left: 0, top: 0 }) as DOMRect;
  fireEvent.click(layer, { clientX: x, clientY: y });
}

describe("BeeswarmReceipt: the swarm", () => {
  it("draws one dot per real offer and one row per group", () => {
    const { container } = renderSwarm();

    expect(container.querySelectorAll("circle.swarm__dot")).toHaveLength(
      POINTS.length
    );
    const labels = Array.from(
      container.querySelectorAll("text.swarm__row-label")
    ).map((n) => n.textContent);
    expect(labels).toEqual(["runpod", "vast_ai"]);
  });

  it("orders rows by population, and pins UNKNOWN last however few it holds", () => {
    const { container } = renderSwarm({
      points: [
        point(9, 2.0, "UNKNOWN", { isUnknown: true }),
        ...POINTS,
        point(10, 2.1, "vast_ai", { provider: "vast_ai" }),
        point(11, 2.6, "vast_ai", { provider: "vast_ai" }),
      ],
    });

    const labels = Array.from(
      container.querySelectorAll("text.swarm__row-label")
    ).map((n) => n.textContent);
    expect(labels).toEqual(["vast_ai", "runpod", "UNKNOWN"]);
  });

  it("keeps every dot inside its own row band", () => {
    const { container } = renderSwarm();

    // Dots are emitted row by row: the three runpod offers, then the two
    // vast_ai ones.
    const cy = Array.from(container.querySelectorAll("circle.swarm__dot")).map(
      (dot) => Number(dot.getAttribute("cy"))
    );
    const firstRow = cy.slice(0, 3);
    const secondRow = cy.slice(3);

    expect(Math.max(...firstRow)).toBeLessThan(Math.min(...secondRow));
  });

  it("compresses many factor rows so region/residual do not stretch the page", () => {
    // 24 sparse region-like rows at the old 56px floor would be ~1.5k tall.
    const many = Array.from({ length: 24 }, (_, i) =>
      point(i + 1, 1.5 + i * 0.05, `r${i}`)
    );
    const { container } = renderSwarm({ factor: "region", points: many });
    const plate = container.querySelector(".swarm__plate");
    const figure = container.querySelector(".swarm__figure");
    expect(plate).not.toBeNull();
    // Crowded floor still exceeds the soft budget, so the plate scrolls inside
    // a capped figure instead of lengthening the page.
    expect(figure?.classList.contains("is-scroll")).toBe(true);
    expect(Number(plate!.getAttribute("height"))).toBeLessThan(1200);
  });

  it("fits a middling factor stack on screen without a scroll pane", () => {
    const mid = Array.from({ length: 10 }, (_, i) =>
      point(i + 1, 1.5 + i * 0.05, `r${i}`)
    );
    const { container } = renderSwarm({ factor: "region", points: mid });
    const plate = container.querySelector(".swarm__plate");
    expect(Number(plate!.getAttribute("height"))).toBeLessThanOrEqual(640);
    expect(
      container.querySelector(".swarm__figure")?.classList.contains("is-scroll")
    ).toBe(false);
  });
});

describe("BeeswarmReceipt: touch targets", () => {
  it("takes a tap 20px off a dot's centre: a 44px target", () => {
    const { container } = renderSwarm();
    // The third runpod offer, well clear of its neighbours on the log axis.
    const dot = dotAt(container, 2);

    tapAt(dot.x, dot.y + 20);

    expect(screen.getByTestId("swarm-receipt-slot").textContent).toContain(
      "$3.15"
    );
  });

  it("ignores a tap that lands beyond the target of every dot", () => {
    const { container } = renderSwarm();
    const dot = dotAt(container, 2);

    tapAt(dot.x, dot.y + 200);

    expect(screen.getByTestId("swarm-receipt-slot").textContent).toContain(
      "Select a dot to file its receipt."
    );
  });

  it("resolves a crowded tap to the nearest dot, so none is unreachable", () => {
    // Two offers a cent apart stack in the same column: the case where
    // per-dot 44px circles would bury one of them under the other.
    const { container } = renderSwarm({
      points: [...POINTS, point(6, 2.42, "runpod")],
    });
    const lower = dotAt(container, 1);
    const stacked = dotAt(container, 2);
    expect(Math.abs(stacked.y - lower.y)).toBeGreaterThan(0);

    tapAt(stacked.x, (lower.y + stacked.y) / 2 + Math.sign(stacked.y - lower.y));

    expect(screen.getByTestId("swarm-receipt-slot").textContent).toContain(
      "$2.42"
    );
  });
});

describe("BeeswarmReceipt: the inline receipt", () => {
  it("reserves the slot before anything is selected, so nothing jumps", () => {
    renderSwarm();

    const slot = screen.getByTestId("swarm-receipt-slot");
    expect(slot).not.toBeNull();
    expect(slot.textContent).toContain("Select a dot to file its receipt.");
  });

  it("files the receipt into that same slot on tap: no new layout box", () => {
    const { container } = renderSwarm();

    const slot = screen.getByTestId("swarm-receipt-slot");
    const dot = dotAt(container, 1);
    tapAt(dot.x, dot.y);

    expect(screen.getByTestId("swarm-receipt-slot")).toBe(slot);
    expect(slot.textContent).toContain("Receipt · offer #2");
    expect(slot.textContent).toContain("$2.41");
    expect(slot.textContent).toContain("on-demand");
    expect(slot.textContent).toContain("h100_sxm_80gb");
    expect(slot.textContent).not.toContain("Select a dot");
  });

  it("wires inspect provenance to the raw observation behind the dot", () => {
    const onInspect = vi.fn();
    const { container } = renderSwarm({ onInspect });

    const dot = dotAt(container, 2);
    tapAt(dot.x, dot.y);
    fireEvent.click(screen.getByRole("button", { name: /inspect provenance/i }));

    expect(onInspect).toHaveBeenCalledWith(1003);
  });

  it("walks the swarm with the arrow keys", () => {
    const { container } = renderSwarm();
    const plate = container.querySelector(".swarm__plate")!;

    fireEvent.keyDown(plate, { key: "ArrowRight" });
    // First dot of the first row, which is the cheapest runpod offer.
    expect(screen.getByTestId("swarm-receipt-slot").textContent).toContain(
      "$1.94"
    );

    fireEvent.keyDown(plate, { key: "ArrowRight" });
    expect(screen.getByTestId("swarm-receipt-slot").textContent).toContain(
      "$2.41"
    );

    fireEvent.keyDown(plate, { key: "ArrowDown" });
    expect(screen.getByTestId("swarm-receipt-slot").textContent).toContain(
      "vast"
    );
  });

  it("drops an open receipt when the factor changes under it", () => {
    const { container, rerender } = renderSwarm();

    const dot = dotAt(container, 0);
    tapAt(dot.x, dot.y);
    expect(screen.getByTestId("swarm-receipt-slot").textContent).toContain(
      "Receipt"
    );

    rerender(
      <BeeswarmReceipt
        factor="commitment"
        points={POINTS}
        gpuSku="h100_sxm_80gb"
        onInspect={() => {}}
      />
    );
    expect(screen.getByTestId("swarm-receipt-slot").textContent).toContain(
      "Select a dot to file its receipt."
    );
  });
});

describe("pointsFromObservations", () => {
  const observation = (
    overrides: Partial<DecompositionObservation>
  ): DecompositionObservation => ({
    canonical_offer_id: 1,
    raw_observation_id: 2,
    collected_at: "2026-08-03T00:00:00Z",
    provider: "runpod",
    price_usd_per_hour: 2.4,
    commitment_type: "on-demand",
    region_country: "US",
    region_state: null,
    region_city: null,
    vcpus_bundled: null,
    ram_gb_bundled: null,
    storage_gb_bundled: null,
    verification_tier: null,
    ...overrides,
  });

  it("marks a missing region as UNKNOWN rather than inventing one", () => {
    const [p] = pointsFromObservations("region", [
      observation({ region_country: null }),
    ]);
    expect(p.groupKey).toBe("UNKNOWN");
    expect(p.isUnknown).toBe(true);
  });

  it("conditions the residual view on provider and commitment together", () => {
    const [p] = pointsFromObservations("residual", [observation({})]);
    expect(p.groupKey).toBe("runpod|on-demand");
    expect(p.groupLabel).toContain("on-demand");
  });
});
