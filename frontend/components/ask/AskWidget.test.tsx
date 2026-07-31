import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AskAnswerBody } from "@/components/ask/AskAnswerBody";
import { AskSources } from "@/components/ask/AskSources";
import { AskWidget } from "@/components/ask/AskWidget";
import { AskWidgetProvider } from "@/components/ask/AskWidgetContext";
import { ASK_FIXTURE_CITED, ASK_FIXTURE_REFUSAL, fixtureResponse } from "@/lib/askMock";
import type { AskStreamEvent } from "@/lib/askBasisTypes";
import { AskError } from "@/lib/askBasisTypes";
import { CLIENT_HISTORY_CAP } from "@/lib/askBasis";

const streamAskMock = vi.fn();

vi.mock("@/lib/askBasis", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/askBasis")>();
  return {
    ...actual,
    streamAsk: (...args: unknown[]) => streamAskMock(...args),
  };
});

async function* citedStream(): AsyncGenerator<AskStreamEvent> {
  const tokens = ASK_FIXTURE_CITED.answer.split(/(\s+)/).filter(Boolean);
  for (const token of tokens) {
    yield { type: "token", token };
  }
  yield { type: "done", response: fixtureResponse(ASK_FIXTURE_CITED) };
}

async function* refusalStream(): AsyncGenerator<AskStreamEvent> {
  yield { type: "token", token: ASK_FIXTURE_REFUSAL.answer };
  yield { type: "done", response: fixtureResponse(ASK_FIXTURE_REFUSAL) };
}

function renderAskWidget() {
  return render(
    <AskWidgetProvider>
      <div data-testid="page-shell">Findings page</div>
      <AskWidget />
    </AskWidgetProvider>
  );
}

async function openDrawer(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "ASK BASIS" }));
  expect(screen.getByRole("dialog", { name: "Ask Basis" })).toBeInTheDocument();
}

describe("AskAnswerBody and AskSources", () => {
  it("renders citation superscripts and expandable sources", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <>
        <AskAnswerBody answer={ASK_FIXTURE_CITED.answer} citations={ASK_FIXTURE_CITED.citations} />
        <AskSources
          citations={ASK_FIXTURE_CITED.citations}
          expanded={false}
          onToggle={onToggle}
        />
      </>
    );

    expect(screen.getByRole("link", { name: "C1" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "T1" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Sources/i }));
    expect(onToggle).toHaveBeenCalled();
  });

  it("lists chunk path and live data badge when expanded", () => {
    render(
      <AskSources
        citations={ASK_FIXTURE_CITED.citations}
        expanded
        onToggle={() => {}}
      />
    );

    expect(screen.getByText("methodology/residual-reveal")).toBeInTheDocument();
    expect(screen.getByText("live data")).toBeInTheDocument();
    expect(screen.getByText(/get_dispersion_summary/)).toBeInTheDocument();
  });
});

describe("AskWidget", () => {
  beforeEach(() => {
    streamAskMock.mockReset();
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("opens and closes via launcher, Esc, and backdrop", async () => {
    const user = userEvent.setup();
    renderAskWidget();

    const launcher = screen.getByRole("button", { name: "ASK BASIS" });
    await user.click(launcher);
    expect(screen.getByRole("dialog", { name: "Ask Basis" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Ask Basis" })).not.toBeInTheDocument();

    await user.click(launcher);
    await user.click(screen.getByRole("button", { name: "Close Ask Basis" }));
    expect(screen.queryByRole("dialog", { name: "Ask Basis" })).not.toBeInTheDocument();
  });

  it("opens with Cmd+K / Ctrl+K", async () => {
    const user = userEvent.setup();
    renderAskWidget();

    await user.keyboard("{Control>}k{/Control}");
    expect(screen.getByRole("dialog", { name: "Ask Basis" })).toBeInTheDocument();
  });

  it("returns focus to the launcher after close", async () => {
    const user = userEvent.setup();
    renderAskWidget();
    const launcher = screen.getByRole("button", { name: "ASK BASIS" });

    await user.click(launcher);
    await user.keyboard("{Escape}");

    expect(launcher).toHaveFocus();
  });

  it("shows validation for empty question", async () => {
    const user = userEvent.setup();
    renderAskWidget();
    await openDrawer(user);

    fireEvent.submit(document.querySelector(".ask-form")!);

    expect(
      await screen.findByText(/Enter a question about Basis data or methodology/)
    ).toBeInTheDocument();
    expect(streamAskMock).not.toHaveBeenCalled();
  });

  it("streams tokens then renders final cited answer", async () => {
    streamAskMock.mockImplementation(() => citedStream());
    const user = userEvent.setup();
    renderAskWidget();
    await openDrawer(user);

    await user.type(
      screen.getByPlaceholderText(/What share of H100-SXM/),
      "What is residual variance?"
    );
    await user.click(screen.getByRole("button", { name: "Ask" }));

    await waitFor(() => {
      expect(screen.getByText(/variance remains as residual/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: "C1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sources/i })).toBeInTheDocument();
  });

  it("renders refusal answers as normal content", async () => {
    streamAskMock.mockImplementation(() => refusalStream());
    const user = userEvent.setup();
    renderAskWidget();
    await openDrawer(user);

    await user.type(
      screen.getByPlaceholderText(/What share of H100-SXM/),
      "Should I buy GPUs?"
    );
    await user.click(screen.getByRole("button", { name: "Ask" }));

    await waitFor(() => {
      expect(screen.getByText(/can't give trading/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sends capped history on follow-up", async () => {
    streamAskMock.mockImplementation(() => citedStream());
    const user = userEvent.setup();
    renderAskWidget();
    await openDrawer(user);

    const input = screen.getByPlaceholderText(/What share of H100-SXM/);

    for (let i = 0; i < CLIENT_HISTORY_CAP + 2; i++) {
      await user.clear(input);
      await user.type(input, `question ${i}`);
      await user.click(screen.getByRole("button", { name: "Ask" }));
      await waitFor(() => expect(streamAskMock).toHaveBeenCalledTimes(i + 1));
    }

    const lastCall = streamAskMock.mock.calls[streamAskMock.mock.calls.length - 1];
    const history = lastCall[1] as { q: string; a: string }[];
    expect(history).toHaveLength(CLIENT_HISTORY_CAP);
    expect(history[0].q).toBe("question 1");
  });

  it("shows rate limit countdown on 429", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    async function* rateLimited(): AsyncGenerator<AskStreamEvent> {
      yield {
        type: "error",
        error: new AskError("Too many requests.", "rate_limited", {
          retryAfterSeconds: 42,
        }),
      };
    }
    streamAskMock.mockImplementation(() => rateLimited());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderAskWidget();
    await openDrawer(user);

    await user.type(screen.getByPlaceholderText(/What share/), "test");
    await user.click(screen.getByRole("button", { name: "Ask" }));

    expect(screen.getByText(/Rate limit reached/i)).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("shows offline message on 503", async () => {
    async function* offline(): AsyncGenerator<AskStreamEvent> {
      yield {
        type: "error",
        error: new AskError("Ask Basis is offline.", "offline"),
      };
    }
    streamAskMock.mockImplementation(() => offline());
    const user = userEvent.setup();
    renderAskWidget();
    await openDrawer(user);

    await user.type(screen.getByPlaceholderText(/What share/), "test");
    await user.click(screen.getByRole("button", { name: "Ask" }));

    expect(screen.getAllByText(/Ask Basis is offline/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();
  });

  it("aborts in-flight stream when a new question is submitted", async () => {
    let aborted = false;
    async function* slowStream(_: string, __: unknown, signal?: AbortSignal) {
      signal?.addEventListener("abort", () => {
        aborted = true;
      });
      yield { type: "token", token: "partial " };
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 5000);
        signal?.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true }
        );
      });
      yield {
        type: "done",
        response: {
          answer: "should not finish",
          citations: [],
          tool_calls: [],
          usage: { input_tokens: 1, output_tokens: 1 },
          trace_id: "x",
        },
      };
    }

    streamAskMock.mockImplementation(slowStream);
    const user = userEvent.setup();
    renderAskWidget();
    await openDrawer(user);

    const input = screen.getByPlaceholderText(/What share/);
    await user.type(input, "first");
    await user.click(screen.getByRole("button", { name: "Ask" }));

    await waitFor(() => expect(screen.getByText(/partial/)).toBeInTheDocument());

    streamAskMock.mockImplementation(() => citedStream());
    await user.type(input, "second question");
    await user.click(screen.getByRole("button", { name: "Ask" }));

    expect(aborted).toBe(true);
  });

  it("offers retry after network drop with partial answer", async () => {
    async function* drop(): AsyncGenerator<AskStreamEvent> {
      yield { type: "token", token: "Partial answer text" };
      yield {
        type: "error",
        error: new AskError("Connection lost while streaming.", "network"),
      };
    }
    streamAskMock.mockImplementation(() => drop());
    const user = userEvent.setup();
    renderAskWidget();
    await openDrawer(user);

    await user.type(screen.getByPlaceholderText(/What share/), "network test");
    await user.click(screen.getByRole("button", { name: "Ask" }));

    expect(screen.getByText(/Partial answer text/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("keeps transcript across simulated route changes", async () => {
    streamAskMock.mockImplementation(() => citedStream());
    const user = userEvent.setup();

    function RouteHarness() {
      const [route, setRoute] = useState("findings");
      return (
        <AskWidgetProvider>
          <div data-testid="route">{route}</div>
          <button type="button" onClick={() => setRoute("basis")}>
            Navigate
          </button>
          <AskWidget />
        </AskWidgetProvider>
      );
    }

    render(<RouteHarness />);
    await openDrawer(user);

    await user.type(
      screen.getByPlaceholderText(/What share of H100-SXM/),
      "What is residual variance?"
    );
    await user.click(screen.getByRole("button", { name: "Ask" }));
    await waitFor(() => {
      expect(screen.getByText(/variance remains as residual/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Navigate" }));
    expect(screen.getByTestId("route")).toHaveTextContent("basis");

    await openDrawer(user);
    expect(screen.getByText(/variance remains as residual/i)).toBeInTheDocument();
  });

  it("uses fullscreen drawer class on mobile widths", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
      matches: query.includes("640px"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const user = userEvent.setup();
    renderAskWidget();
    await openDrawer(user);

    expect(screen.getByRole("dialog", { name: "Ask Basis" })).toHaveClass(
      "ask-drawer--fullscreen"
    );
  });
});
