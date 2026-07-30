import { describe, expect, it } from "vitest";
import {
  findCitation,
  parseAnswerWithCitations,
  resolveDocHref,
} from "@/lib/askCitations";
import type { AskCitation } from "@/lib/askBasisTypes";

describe("askCitations", () => {
  const citations: AskCitation[] = [
    {
      id: 1,
      kind: "chunk",
      source_path: "methodology/residual-reveal",
      heading: "Residual variance share",
    },
    {
      id: 1,
      kind: "tool",
      tool: "get_dispersion_summary",
      as_of: "2026-07-28T12:00:00Z",
    },
  ];

  it("parses inline chunk and tool markers", () => {
    const segments = parseAnswerWithCitations(
      "Residual is high [C1] and dispersion is live [T1]."
    );
    expect(segments).toEqual([
      { type: "text", value: "Residual is high " },
      { type: "citation", kind: "chunk", id: 1, label: "[C1]" },
      { type: "text", value: " and dispersion is live " },
      { type: "citation", kind: "tool", id: 1, label: "[T1]" },
      { type: "text", value: "." },
    ]);
  });

  it("maps known doc paths to site routes", () => {
    expect(resolveDocHref("methodology/residual-reveal")).toBe("/methodology");
    expect(resolveDocHref("unknown/path")).toBeNull();
  });

  it("finds citations by kind and id", () => {
    expect(findCitation(citations, "chunk", 1)?.heading).toBe(
      "Residual variance share"
    );
    expect(findCitation(citations, "tool", 1)?.tool).toBe("get_dispersion_summary");
  });
});
