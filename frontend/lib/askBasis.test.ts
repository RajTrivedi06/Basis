import { beforeEach, describe, expect, it, vi } from "vitest";
import { CLIENT_HISTORY_CAP, capHistory } from "@/lib/askBasis";
import { mockAskStream } from "@/lib/askMock";
import type { AskHistoryEntry } from "@/lib/askBasisTypes";

describe("capHistory", () => {
  it("returns all entries when under the cap", () => {
    const history: AskHistoryEntry[] = [
      { q: "a", a: "1" },
      { q: "b", a: "2" },
    ];
    expect(capHistory(history)).toEqual(history);
  });

  it("keeps only the last N exchanges when over the cap", () => {
    const history: AskHistoryEntry[] = Array.from({ length: 6 }, (_, i) => ({
      q: `q${i}`,
      a: `a${i}`,
    }));
    const capped = capHistory(history);
    expect(capped).toHaveLength(CLIENT_HISTORY_CAP);
    expect(capped[0]).toEqual({ q: "q2", a: "a2" });
    expect(capped[capped.length - 1]).toEqual({ q: "q5", a: "a5" });
  });
});

describe("mockAskStream", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("streams tokens then emits done envelope", async () => {
    const events: string[] = [];
    const iter = mockAskStream("What is residual variance?", []);

    const pump = (async () => {
      for await (const event of iter) {
        if (event.type === "token") events.push(event.token);
        if (event.type === "done") {
          expect(event.response.citations.length).toBeGreaterThan(0);
          expect(event.response.answer).toContain("[C1]");
        }
      }
    })();

    await vi.runAllTimersAsync();
    await pump;

    expect(events.join("")).toContain("residual");
    vi.useRealTimers();
  });

  it("returns refusal fixture for procurement questions", async () => {
    let answer = "";
    const iter = mockAskStream("Should I buy spot GPUs?", []);
    const pump = (async () => {
      for await (const event of iter) {
        if (event.type === "done") answer = event.response.answer;
      }
    })();
    await vi.runAllTimersAsync();
    await pump;

    expect(answer).toMatch(/can't give trading/i);
    expect(answer).not.toMatch(/\[C\d+\]/);
    vi.useRealTimers();
  });
});
