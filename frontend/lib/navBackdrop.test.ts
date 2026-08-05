import { describe, expect, it } from "vitest";
import { resolveNavBackdrop, type NavBackdropSection } from "@/lib/navBackdrop";

const SECTIONS: NavBackdropSection[] = [
  { top: 0, bottom: 900, backdrop: "film" },
  { top: 900, bottom: 1800, backdrop: "paper" },
  { top: 1800, bottom: 2600, backdrop: "paper-warm" },
  { top: 2600, bottom: 3400, backdrop: "film" },
];

describe("resolveNavBackdrop", () => {
  it("returns the section under the probe", () => {
    expect(resolveNavBackdrop(400, SECTIONS)).toBe("film");
    expect(resolveNavBackdrop(1200, SECTIONS)).toBe("paper");
    expect(resolveNavBackdrop(2200, SECTIONS)).toBe("paper-warm");
    expect(resolveNavBackdrop(3000, SECTIONS)).toBe("film");
  });

  it("uses the first section above the page top", () => {
    expect(resolveNavBackdrop(-20, SECTIONS)).toBe("film");
  });

  it("uses the last section past the file end", () => {
    expect(resolveNavBackdrop(5000, SECTIONS)).toBe("film");
  });

  it("falls back to paper when no sections are registered", () => {
    expect(resolveNavBackdrop(100, [])).toBe("paper");
  });
});
