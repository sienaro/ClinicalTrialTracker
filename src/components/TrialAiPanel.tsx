"use client";

import { useEffect, useRef, useState } from "react";

type Explanation = {
  summary: string;
  goal: string;
  whatHappens: string[];
  whoFor: string;
};

type ChatTurn = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What is this study testing in simple terms?",
  "What would I have to do if I joined?",
  "Are there any age or health requirements?",
];

const sparkle = (
  <svg className="h-4 w-4 text-rose-500" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
  </svg>
);

export function TrialAiPanel({
  nctId,
  title,
  briefSummary,
  eligibilityText,
}: {
  nctId: string;
  title: string;
  briefSummary: string;
  eligibilityText: string;
}) {
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [explLoading, setExplLoading] = useState(true);
  const [explError, setExplError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setExplLoading(true);
      setExplError(null);
      try {
        const res = await fetch("/api/trials/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, briefSummary, eligibilityText }),
        });
        const data: unknown = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setExplError(
            data && typeof data === "object" && "error" in data
              ? String((data as { error: unknown }).error)
              : "Could not generate explanation.",
          );
          return;
        }
        setExplanation((data as { explanation: Explanation }).explanation);
      } catch {
        if (!cancelled) setExplError("Could not reach the AI explainer.");
      } finally {
        if (!cancelled) setExplLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nctId, title, briefSummary, eligibilityText]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, chatLoading]);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || chatLoading) return;
    setChatError(null);
    const nextMessages = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(nextMessages);
    setQuestion("");
    setChatLoading(true);
    try {
      const res = await fetch("/api/trials/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          title,
          briefSummary,
          eligibilityText,
          history: messages.slice(-6),
        }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        setChatError(
          data && typeof data === "object" && "error" in data
            ? String((data as { error: unknown }).error)
            : "Could not get an answer.",
        );
        return;
      }
      setMessages([...nextMessages, { role: "assistant", content: (data as { answer: string }).answer }]);
    } catch {
      setChatError("Could not reach the AI assistant.");
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Plain-language explainer */}
      <section className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/60 to-white p-5 shadow-sm ring-1 ring-rose-100 sm:p-6">
        <div className="flex items-center gap-2">
          {sparkle}
          <h2 className="text-base font-semibold text-slate-900">In plain language</h2>
        </div>

        {explLoading ? (
          <div className="mt-4 space-y-2.5">
            <div className="skeleton h-3 w-full rounded" />
            <div className="skeleton h-3 w-5/6 rounded" />
            <div className="skeleton h-3 w-2/3 rounded" />
          </div>
        ) : explError ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{explError}</p>
        ) : explanation ? (
          <div className="mt-4 space-y-3.5 text-sm leading-relaxed text-slate-700">
            <p>{explanation.summary}</p>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Goal</p>
              <p className="mt-0.5">{explanation.goal}</p>
            </div>
            {explanation.whatHappens?.length ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">What participation involves</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 marker:text-rose-300">
                  {explanation.whatHappens.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Who it&apos;s for</p>
              <p className="mt-0.5">{explanation.whoFor}</p>
            </div>
          </div>
        ) : null}
        <p className="mt-4 text-xs text-slate-400">AI-generated from the public study text. Not medical advice.</p>
      </section>

      {/* Ask-AI chat */}
      <section className="flex flex-col rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6">
        <div className="flex items-center gap-2">
          {sparkle}
          <h2 className="text-base font-semibold text-slate-900">Ask about this trial</h2>
        </div>

        <div ref={scrollRef} className="mt-4 max-h-72 flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.length === 0 && !chatLoading ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-500">Ask anything about this study&apos;s eligibility or design:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void ask(s)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-rose-300 hover:text-rose-700"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] rounded-2xl rounded-br-sm bg-rose-600 px-3.5 py-2 text-sm text-white"
                    : "max-w-[90%] rounded-2xl rounded-bl-sm bg-slate-100 px-3.5 py-2 text-sm text-slate-800"
                }
              >
                {m.content}
              </div>
            </div>
          ))}

          {chatLoading ? (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-slate-100 px-3.5 py-2.5">
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {chatError ? (
          <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">{chatError}</p>
        ) : null}

        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(question);
          }}
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Type your question…"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
          />
          <button
            type="submit"
            disabled={chatLoading || !question.trim()}
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Ask
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-400">
          Answers come from this trial&apos;s text only and may be imperfect. Confirm with the study team.
        </p>
      </section>
    </div>
  );
}
