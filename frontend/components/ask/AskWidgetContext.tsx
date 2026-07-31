"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AskCitation, AskError, TranscriptTurn } from "@/lib/askBasisTypes";
import { AskError as AskErrorClass } from "@/lib/askBasisTypes";
import { capHistory, streamAsk } from "@/lib/askBasis";

type AskWidgetContextValue = {
  open: boolean;
  openWidget: () => void;
  closeWidget: () => void;
  toggleWidget: () => void;
  turns: TranscriptTurn[];
  question: string;
  setQuestion: (value: string) => void;
  streaming: boolean;
  partialAnswer: string | null;
  partialCitations: AskCitation[];
  error: AskError | null;
  sourcesExpanded: Record<number, boolean>;
  toggleSources: (index: number) => void;
  rateLimitSeconds: number | null;
  formDisabled: boolean;
  offline: boolean;
  submitQuestion: (q: string) => Promise<void>;
  handleSubmit: (event: React.FormEvent) => void;
  handleRetry: () => void;
  formId: string;
};

const AskWidgetContext = createContext<AskWidgetContextValue | null>(null);

export function useAskWidget(): AskWidgetContextValue {
  const value = useContext(AskWidgetContext);
  if (!value) {
    throw new Error("useAskWidget must be used within AskWidgetProvider");
  }
  return value;
}

type AskWidgetProviderProps = {
  children: ReactNode;
  initialRateLimitSeconds?: number;
};

export function AskWidgetProvider({
  children,
  initialRateLimitSeconds,
}: AskWidgetProviderProps) {
  const formId = useId();
  const abortRef = useRef<AbortController | null>(null);

  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [partialAnswer, setPartialAnswer] = useState<string | null>(null);
  const [partialCitations, setPartialCitations] = useState<AskCitation[]>([]);
  const [error, setError] = useState<AskError | null>(null);
  const [sourcesExpanded, setSourcesExpanded] = useState<Record<number, boolean>>({});
  const [rateLimitSeconds, setRateLimitSeconds] = useState<number | null>(
    initialRateLimitSeconds ?? null
  );
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (rateLimitSeconds == null || rateLimitSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setRateLimitSeconds((prev) => {
        if (prev == null || prev <= 1) return null;
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [rateLimitSeconds]);

  const history = capHistory(turns.map((t) => ({ q: t.question, a: t.answer })));

  const submitQuestion = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setError(null);
      setStreaming(true);
      setPartialAnswer("");
      setPartialCitations([]);
      setLastQuestion(trimmed);
      setQuestion("");

      let streamed = "";
      let finalTurn: TranscriptTurn | null = null;

      try {
        for await (const event of streamAsk(trimmed, history, controller.signal)) {
          if (event.type === "token") {
            streamed += event.token;
            setPartialAnswer(streamed);
          } else if (event.type === "done") {
            finalTurn = {
              question: trimmed,
              answer: event.response.answer,
              citations: event.response.citations,
              usage: event.response.usage,
            };
            setPartialAnswer(null);
            setPartialCitations([]);
          } else if (event.type === "error") {
            setError(event.error);
            if (
              event.error.code === "rate_limited" &&
              event.error.retryAfterSeconds != null
            ) {
              setRateLimitSeconds(event.error.retryAfterSeconds);
            }
            if (streamed.length > 0) {
              setPartialAnswer(streamed);
            }
            break;
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        if (streamed.length > 0) {
          setPartialAnswer(streamed);
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }

      if (finalTurn) {
        setTurns((prev) => {
          const next = [...prev, finalTurn!];
          setSourcesExpanded((expanded) => ({
            ...expanded,
            [prev.length]: finalTurn!.citations.length > 0,
          }));
          return next;
        });
      }
    },
    [history]
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (!question.trim()) {
        setError(
          new AskErrorClass("Enter a question about Basis data or methodology.", "bad_request")
        );
        return;
      }
      void submitQuestion(question);
    },
    [question, submitQuestion]
  );

  const handleRetry = useCallback(() => {
    if (lastQuestion) void submitQuestion(lastQuestion);
  }, [lastQuestion, submitQuestion]);

  const openWidget = useCallback(() => setOpen(true), []);
  const closeWidget = useCallback(() => setOpen(false), []);
  const toggleWidget = useCallback(() => setOpen((value) => !value), []);

  const toggleSources = useCallback((index: number) => {
    setSourcesExpanded((prev) => ({ ...prev, [index]: !prev[index] }));
  }, []);

  const rateLimited = rateLimitSeconds != null && rateLimitSeconds > 0;
  const offline = error?.code === "offline";
  const formDisabled = rateLimited || offline;

  const value = useMemo(
    () => ({
      open,
      openWidget,
      closeWidget,
      toggleWidget,
      turns,
      question,
      setQuestion,
      streaming,
      partialAnswer,
      partialCitations,
      error,
      sourcesExpanded,
      toggleSources,
      rateLimitSeconds,
      formDisabled,
      offline,
      submitQuestion,
      handleSubmit,
      handleRetry,
      formId,
    }),
    [
      open,
      openWidget,
      closeWidget,
      toggleWidget,
      turns,
      question,
      streaming,
      partialAnswer,
      partialCitations,
      error,
      sourcesExpanded,
      toggleSources,
      rateLimitSeconds,
      formDisabled,
      offline,
      submitQuestion,
      handleSubmit,
      handleRetry,
      formId,
    ]
  );

  return (
    <AskWidgetContext.Provider value={value}>{children}</AskWidgetContext.Provider>
  );
}
