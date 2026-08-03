import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BasisLockup } from "@/components/layout/BasisLockup";
import { SiteHeader } from "@/components/layout/SiteHeader";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(""),
}));

describe("BasisLockup", () => {
  it("locks the bracket monogram up with the Basis wordmark", () => {
    const { container } = render(<BasisLockup />);

    const word = container.querySelector(".basis-lockup__word")!;
    expect(word.textContent).toBe("Basis");

    const monogram = container.querySelector(".bracket-monogram")!;
    expect(monogram.getAttribute("viewBox")).toBe("0 0 22 22");
    // Two price lines, the spine, and a tick at each end.
    expect(monogram.querySelectorAll("line")).toHaveLength(5);
  });

  it("strokes the monogram with tokens only", () => {
    const { container } = render(<BasisLockup />);
    const strokes = Array.from(
      container.querySelectorAll(".bracket-monogram line")
    ).map((line) => line.getAttribute("stroke"));

    expect(strokes).toHaveLength(5);
    strokes.forEach((stroke) => expect(stroke).toBe("var(--ink)"));
  });

  it("drops the wordmark in the mark-only variant", () => {
    const { container } = render(<BasisLockup variant="mark" />);
    expect(container.querySelector(".basis-lockup__word")).toBeNull();
    expect(container.querySelector(".bracket-monogram")).not.toBeNull();
  });

  it("renders the mark drawn, not blank, before any reveal fires", () => {
    const { container } = render(<BasisLockup />);
    expect(container.querySelector(".is-bracket-drawing")).toBeNull();
  });
});

describe("SiteHeader", () => {
  it("uses the bracket lockup as the site logo", () => {
    const { container } = render(<SiteHeader />);

    const brand = container.querySelector(".site-header-island__brand")!;
    expect(brand.querySelector(".basis-lockup")).not.toBeNull();
    expect(brand.querySelector(".basis-lockup__word")!.textContent).toBe(
      "Basis"
    );
    expect(screen.getByLabelText("Basis home")).toBeInTheDocument();
  });
});
