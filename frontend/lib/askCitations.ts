import type { AskCitation, AskCitationKind } from "@/lib/askBasisTypes";

/** Map doc source_path values to on-site routes where a page exists. */
const DOC_PATH_ROUTES: Record<string, string> = {
  methodology: "/methodology",
  "methodology/residual-reveal": "/methodology",
  "methodology/pipeline": "/methodology",
  findings: "/",
  dispersion: "/dispersion",
  basis: "/basis",
  providers: "/providers",
  explainability: "/explainability",
};

export function citationMarkerPrefix(kind: AskCitationKind): "C" | "T" {
  return kind === "chunk" ? "C" : "T";
}

export function citationMarkerLabel(kind: AskCitationKind, id: number): string {
  return `[${citationMarkerPrefix(kind)}${id}]`;
}

export function resolveDocHref(sourcePath?: string): string | null {
  if (!sourcePath) return null;
  const normalized = sourcePath.replace(/^\/+/, "").replace(/\.md$/, "");
  return DOC_PATH_ROUTES[normalized] ?? null;
}

export function findCitation(
  citations: AskCitation[],
  kind: AskCitationKind,
  id: number
): AskCitation | undefined {
  return citations.find((c) => c.kind === kind && c.id === id);
}

export type ParsedAnswerSegment =
  | { type: "text"; value: string }
  | { type: "citation"; kind: AskCitationKind; id: number; label: string };

const CITATION_RE = /\[(C|T)(\d+)\]/g;

export function parseAnswerWithCitations(answer: string): ParsedAnswerSegment[] {
  const segments: ParsedAnswerSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = CITATION_RE.exec(answer)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: answer.slice(lastIndex, match.index) });
    }
    const kind: AskCitationKind = match[1] === "C" ? "chunk" : "tool";
    const id = Number(match[2]);
    segments.push({
      type: "citation",
      kind,
      id,
      label: match[0],
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < answer.length) {
    segments.push({ type: "text", value: answer.slice(lastIndex) });
  }

  return segments;
}

export function formatAsOf(iso?: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}
