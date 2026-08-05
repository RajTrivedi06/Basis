import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BracketMark } from "@/components/marks/BracketMark";
import {
  BRACKET_BENCHMARK_LABEL,
  BRACKET_FOOTNOTE,
  BRACKET_PAID_LABEL,
  BRACKET_REFERENCE_HINT,
  BracketDiagram,
} from "@/components/marks/BracketDiagram";

function renderMark(props: Partial<Parameters<typeof BracketMark>[0]> = {}) {
  return render(
    <svg>
      <BracketMark spine={354} start={52} length={110} {...props} />
    </svg>
  );
}

describe("BracketMark", () => {
  it("places the spine inside the measured span and slashes both ends", () => {
    const { container } = renderMark();

    const spine = container.querySelector(".bracket-mark__spine")!;
    expect(spine.getAttribute("x1")).toBe("354");
    expect(spine.getAttribute("x2")).toBe("354");
    expect(spine.getAttribute("y1")).toBe("56");
    expect(spine.getAttribute("y2")).toBe("158");

    // 45° drafting ticks centred on each spine end.
    const ticks = Array.from(
      container.querySelectorAll(
        ".bracket-mark__seg:not(.bracket-mark__spine):not(.bracket-mark__leader)"
      )
    );
    expect(ticks).toHaveLength(2);
    expect(ticks.map((t) => t.getAttribute("y1"))).toEqual(["63", "165"]);
    expect(ticks.map((t) => t.getAttribute("y2"))).toEqual(["49", "151"]);
  });

  it("mirrors the same geometry when horizontal", () => {
    const { container } = renderMark({
      orientation: "horizontal",
      spine: 200,
      start: 20,
      length: 100,
    });

    const spine = container.querySelector(".bracket-mark__spine")!;
    expect(spine.getAttribute("y1")).toBe("200");
    expect(spine.getAttribute("y2")).toBe("200");
    expect(spine.getAttribute("x1")).toBe("24");
    expect(spine.getAttribute("x2")).toBe("116");
  });

  it("draws leaders only when both leader bounds are given", () => {
    const { container: without } = renderMark();
    expect(without.querySelectorAll(".bracket-mark__leader")).toHaveLength(0);

    const { container: with_ } = renderMark({ leaderFrom: 312, leaderTo: 368 });
    expect(with_.querySelectorAll(".bracket-mark__leader")).toHaveLength(2);
  });

  it("colors by tone using tokens — void only where it measures the residual", () => {
    const { container: ink } = renderMark();
    expect(ink.querySelector(".bracket-mark__spine")!.getAttribute("stroke")).toBe(
      "var(--ink)"
    );

    const { container: dark } = renderMark({ tone: "void" });
    expect(
      dark.querySelector(".bracket-mark__spine")!.getAttribute("stroke")
    ).toBe("var(--residual)");
  });

  it("sets the italic serif label in the bracket's gap", () => {
    const { container } = renderMark({ label: "basis" });
    const label = container.querySelector(".bracket-mark__label")!;
    expect(label.textContent).toBe("basis");
    expect(label.getAttribute("font-style")).toBe("italic");
    expect(label.getAttribute("x")).toBe("370");
  });
});

describe("BracketDiagram", () => {
  it("carries the reference gloss and footnote", () => {
    render(<BracketDiagram />);
    expect(screen.getByText(BRACKET_REFERENCE_HINT)).toBeInTheDocument();
    expect(screen.getByText(BRACKET_FOOTNOTE)).toBeInTheDocument();
  });

  it("suppresses the footnote when the caption already carries it", () => {
    render(<BracketDiagram showFootnote={false} />);
    expect(screen.queryByText(BRACKET_FOOTNOTE)).not.toBeInTheDocument();
    expect(screen.queryByText(BRACKET_REFERENCE_HINT)).not.toBeInTheDocument();
  });

  it("labels both price lines and omits figures it has not been given", () => {
    const { container } = render(<BracketDiagram />);
    expect(screen.getByText(BRACKET_BENCHMARK_LABEL)).toBeInTheDocument();
    expect(screen.getByText(BRACKET_PAID_LABEL)).toBeInTheDocument();
    expect(container.querySelectorAll(".bracket-diagram__value")).toHaveLength(0);
  });

  it("renders live figures when they are supplied", () => {
    render(<BracketDiagram benchmarkValue="$2.41" paidValue="$0.62" />);
    expect(screen.getByText("$2.41")).toBeInTheDocument();
    expect(screen.getByText("$0.62")).toBeInTheDocument();
  });

  it("renders the finished bracket before any reveal fires", () => {
    const { container } = render(<BracketDiagram />);
    expect(container.querySelector(".is-bracket-drawing")).toBeNull();
    expect(container.querySelectorAll(".bracket-mark__seg").length).toBeGreaterThan(
      0
    );
  });
});
