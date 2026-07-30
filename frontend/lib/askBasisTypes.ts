/** Wire contract for POST /api/ask (Stage 4, Task 4.5). */

export type AskHistoryEntry = {
  q: string;
  a: string;
};

export type AskCitationKind = "chunk" | "tool";

export type AskCitation = {
  id: number;
  kind: AskCitationKind;
  source_path?: string;
  heading?: string;
  tool?: string;
  as_of?: string;
};

export type AskToolCall = {
  id: number;
  tool: string;
  as_of: string;
};

export type AskUsage = {
  input_tokens: number;
  output_tokens: number;
};

export type AskResponse = {
  answer: string;
  citations: AskCitation[];
  tool_calls: AskToolCall[];
  usage: AskUsage;
  trace_id: string;
};

export type AskRequest = {
  question: string;
  history?: AskHistoryEntry[];
};

export type AskErrorCode = "rate_limited" | "offline" | "bad_request" | "network";

export class AskError extends Error {
  readonly code: AskErrorCode;
  readonly retryAfterSeconds?: number;
  readonly status?: number;

  constructor(
    message: string,
    code: AskErrorCode,
    options?: { retryAfterSeconds?: number; status?: number }
  ) {
    super(message);
    this.name = "AskError";
    this.code = code;
    this.retryAfterSeconds = options?.retryAfterSeconds;
    this.status = options?.status;
  }
}

export type AskStreamEvent =
  | { type: "token"; token: string }
  | { type: "done"; response: AskResponse }
  | { type: "error"; error: AskError };

export type TranscriptTurn = {
  question: string;
  answer: string;
  citations: AskCitation[];
  usage?: AskUsage;
};
