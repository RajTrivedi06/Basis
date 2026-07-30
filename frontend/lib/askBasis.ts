/**
 * Ask Basis client — POST /api/ask with JSON or SSE streaming.
 */

import { mockAskResponse, mockAskStream } from "@/lib/askMock";
import type {
  AskError,
  AskHistoryEntry,
  AskRequest,
  AskResponse,
  AskStreamEvent,
} from "@/lib/askBasisTypes";
import { AskError as AskErrorClass } from "@/lib/askBasisTypes";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/** Client-side cap on history pairs sent to the server (Amendment A). */
export const CLIENT_HISTORY_CAP = 4;

export function capHistory(history: AskHistoryEntry[]): AskHistoryEntry[] {
  if (history.length <= CLIENT_HISTORY_CAP) return history;
  return history.slice(-CLIENT_HISTORY_CAP);
}

export function shouldUseAskFixture(): boolean {
  return process.env.NEXT_PUBLIC_ASK_BASIS_FIXTURE === "true";
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (!Number.isNaN(seconds)) return Math.max(0, Math.ceil(seconds));
  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    return Math.max(0, Math.ceil((date - Date.now()) / 1000));
  }
  return undefined;
}

async function readError(res: Response): Promise<AskError> {
  let detail = res.statusText;
  try {
    const body = (await res.json()) as { detail?: string };
    if (typeof body?.detail === "string") detail = body.detail;
  } catch {
    /* ignore */
  }

  if (res.status === 429) {
    return new AskErrorClass(detail || "Rate limit exceeded.", "rate_limited", {
      retryAfterSeconds: parseRetryAfter(res.headers.get("Retry-After")),
      status: 429,
    });
  }
  if (res.status === 503) {
    return new AskErrorClass(detail || "Ask Basis is offline.", "offline", {
      status: 503,
    });
  }
  if (res.status === 400) {
    return new AskErrorClass(detail || "Question is too long or invalid.", "bad_request", {
      status: 400,
    });
  }
  return new AskErrorClass(detail || `Request failed (${res.status}).`, "network", {
    status: res.status,
  });
}

function parseSseBlock(block: string): AskStreamEvent | null {
  const lines = block.split("\n");
  let eventName = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) return null;
  const data = dataLines.join("\n");

  if (eventName === "done") {
    try {
      const response = JSON.parse(data) as AskResponse;
      return { type: "done", response };
    } catch {
      return null;
    }
  }

  return { type: "token", token: data };
}

export async function* streamAsk(
  question: string,
  history: AskHistoryEntry[] = [],
  signal?: AbortSignal
): AsyncGenerator<AskStreamEvent> {
  if (shouldUseAskFixture()) {
    yield* mockAskStream(question, capHistory(history), signal);
    return;
  }

  const body: AskRequest = {
    question,
    history: capHistory(history),
  };

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/ask`, {
      method: "POST",
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    yield {
      type: "error",
      error: new AskErrorClass("Network error. Check your connection and try again.", "network"),
    };
    return;
  }

  if (!res.ok) {
    yield { type: "error", error: await readError(res) };
    return;
  }

  if (!res.body) {
    yield {
      type: "error",
      error: new AskErrorClass("Empty response from server.", "network"),
    };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const event = parseSseBlock(trimmed);
        if (event) yield event;
      }
    }

    const tail = buffer.trim();
    if (tail) {
      const event = parseSseBlock(tail);
      if (event) yield event;
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    yield {
      type: "error",
      error: new AskErrorClass("Connection lost while streaming.", "network"),
    };
  } finally {
    reader.releaseLock();
  }
}

export async function askJson(
  question: string,
  history: AskHistoryEntry[] = [],
  signal?: AbortSignal
): Promise<AskResponse> {
  if (shouldUseAskFixture()) {
    return mockAskResponse(question, capHistory(history));
  }

  const body: AskRequest = {
    question,
    history: capHistory(history),
  };

  const res = await fetch(`${BASE_URL}/api/ask`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    throw await readError(res);
  }

  return (await res.json()) as AskResponse;
}
