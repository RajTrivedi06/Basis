import { describe, expect, it } from "vitest";
import { factorColor, type Factor } from "@/lib/factorColor";

describe("factorColor", () => {
  const cases: [Factor, string][] = [
    ["region", "var(--factor-region)"],
    ["commitment", "var(--factor-commitment)"],
    ["provider", "var(--factor-provider)"],
    ["bundle", "var(--factor-bundle)"],
    ["residual", "var(--residual)"],
  ];

  it.each(cases)("returns the CSS variable for %s", (factor, expected) => {
    expect(factorColor(factor)).toBe(expected);
  });
});
