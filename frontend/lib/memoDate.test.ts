import { describe, expect, it } from "vitest";
import { formatMemoDate } from "@/lib/memoDate";

describe("formatMemoDate", () => {
  it("formats ISO timestamps as uppercase memo stamps", () => {
    expect(formatMemoDate("2026-08-02T09:00:00Z")).toBe("AUG 2");
    expect(formatMemoDate("2026-07-31")).toBe("JUL 31");
  });

  it("returns an em dash for missing or invalid input", () => {
    expect(formatMemoDate(null)).toBe("-");
    expect(formatMemoDate("not-a-date")).toBe("-");
  });
});
