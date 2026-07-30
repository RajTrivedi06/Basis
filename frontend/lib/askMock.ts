/**
 * Dev-only SSE mock for POST /api/ask.
 * Activated via NEXT_PUBLIC_ASK_BASIS_FIXTURE=true.
 */

import transcript from "@/fixtures/ask-basis-transcript.json";
import type { AskHistoryEntry, AskResponse, AskStreamEvent } from "@/lib/askBasisTypes";

const FIXTURE = transcript as {
  cited: AskResponse & { question: string };
  refusal: AskResponse & { question: string };
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

function pickFixture(question: string, history: AskHistoryEntry[]): typeof FIXTURE.cited {
  const lower = question.toLowerCase();
  if (
    lower.includes("buy") ||
    lower.includes("should i") ||
    lower.includes("procurement") ||
    lower.includes("trading")
  ) {
    return FIXTURE.refusal;
  }
  if (history.length > 0 && lower.includes("follow")) {
    return {
      ...FIXTURE.cited,
      question,
      answer:
        "Following up: the residual share and dispersion figures above are from the same public snapshot window. I don't have newer live numbers in this fixture.",
      trace_id: "fixture-followup-trace",
    };
  }
  return FIXTURE.cited;
}

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const re = /\S+\s*/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    tokens.push(match[0]);
  }
  return tokens.length > 0 ? tokens : [text];
}

export function fixtureResponse(fixture: AskResponse & { question: string }): AskResponse {
  const { answer, citations, tool_calls, usage, trace_id } = fixture;
  return { answer, citations, tool_calls, usage, trace_id };
}

export async function* mockAskStream(
  question: string,
  history: AskHistoryEntry[] = [],
  signal?: AbortSignal
): AsyncGenerator<AskStreamEvent> {
  const fixture = pickFixture(question, history);
  const tokens = tokenize(fixture.answer);

  for (const token of tokens) {
    await sleep(8, signal);
    yield { type: "token", token };
  }

  yield {
    type: "done",
    response: fixtureResponse(fixture),
  };
}

export function mockAskResponse(question: string, history: AskHistoryEntry[] = []): AskResponse {
  return fixtureResponse(pickFixture(question, history));
}

export const ASK_FIXTURE_CITED = FIXTURE.cited;
export const ASK_FIXTURE_REFUSAL = FIXTURE.refusal;
