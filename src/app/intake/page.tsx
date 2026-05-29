"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveProfilePrefill } from "@/lib/profilePrefill";
import { useLanguage, languageInstruction } from "@/components/LanguageProvider";
import { LanguageSelector } from "@/components/LanguageSelector";
import type { Sex } from "@/lib/clinicalTrialsGov";

type ChatTurn = { role: "user" | "assistant"; content: string };

type ExtractedProfile = {
  condition?: string;
  ageInput?: string;
  sex?: Sex;
  sessionNotes?: string;
  location?: string;
};

const GREETING =
  "Hi! I'm here to help you find clinical trials. To start, what health condition or diagnosis are you looking into?";

const STARTERS = [
  "I have type 2 diabetes",
  "Looking for breast cancer trials",
  "I have rheumatoid arthritis and I'm 60",
];

const AssistantAvatar = () => (
  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-amber-500 shadow-sm">
    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h4l2-6 4 12 2-6h6" />
    </svg>
  </span>
);

export default function IntakePage() {
  const router = useRouter();
  const { language, readingLevel } = useLanguage();

  const [messages, setMessages] = useState<ChatTurn[]>([{ role: "assistant", content: GREETING }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ExtractedProfile | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, profile]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setError(null);
    const nextMessages: ChatTurn[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, languageInstruction: languageInstruction(language, readingLevel) }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        setError(
          data && typeof data === "object" && "error" in data
            ? String((data as { error: unknown }).error)
            : "Something went wrong.",
        );
        return;
      }
      const result = data as { reply: string; ready: boolean; profile?: ExtractedProfile };
      setMessages([...nextMessages, { role: "assistant", content: result.reply }]);
      if (result.ready && result.profile?.condition) {
        setProfile(result.profile);
      }
    } catch {
      setError("Could not reach the assistant.");
    } finally {
      setLoading(false);
    }
  }

  function findTrials() {
    if (!profile?.condition) return;
    saveProfilePrefill({
      condition: profile.condition,
      ageInput: profile.ageInput || undefined,
      sex: (profile.sex as Sex) || undefined,
      sessionNotes: profile.sessionNotes || undefined,
      location: profile.location || undefined,
      autoSearch: true,
    });
    router.push("/search");
  }

  const onlyGreeting = messages.length === 1;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-57px)] w-full max-w-3xl flex-col px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-3">
          <AssistantAvatar />
          <div>
            <h1 className="text-base font-semibold leading-tight text-slate-900">Trial Assistant</h1>
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Online · powered by Gemini
            </p>
          </div>
        </div>
        <LanguageSelector compact />
      </div>

      {/* Chat panel */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm ring-1 ring-slate-900/5">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {messages.map((m, i) =>
            m.role === "assistant" ? (
              <div key={i} className="flex items-end gap-2">
                <AssistantAvatar />
                <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-slate-100 px-3.5 py-2.5 text-sm leading-relaxed text-slate-800">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-rose-600 px-3.5 py-2.5 text-sm leading-relaxed text-white">
                  {m.content}
                </div>
              </div>
            ),
          )}

          {/* Starter chips */}
          {onlyGreeting && !loading ? (
            <div className="flex flex-wrap gap-2 pl-9">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-rose-300 hover:text-rose-700"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-end gap-2">
              <AssistantAvatar />
              <div className="rounded-2xl rounded-bl-sm bg-slate-100 px-3.5 py-3">
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                </span>
              </div>
            </div>
          ) : null}

          {/* Ready-to-search card */}
          {profile?.condition ? (
            <div className="animate-fade-in-up ml-9 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-900">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Here&apos;s what I&apos;ll search
              </p>
              <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-700">
                <div><span className="font-medium text-slate-500">Condition:</span> {profile.condition}</div>
                {profile.ageInput ? <div><span className="font-medium text-slate-500">Age:</span> {profile.ageInput}</div> : null}
                {profile.sex && profile.sex !== "any" ? <div><span className="font-medium text-slate-500">Sex:</span> {profile.sex}</div> : null}
                {profile.location ? <div><span className="font-medium text-slate-500">Location:</span> {profile.location}</div> : null}
              </dl>
              {profile.sessionNotes ? (
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  <span className="font-medium text-slate-500">Context:</span> {profile.sessionNotes}
                </p>
              ) : null}
              <button
                type="button"
                onClick={findTrials}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500"
              >
                Find my trials
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          ) : null}

          {error ? (
            <p className="ml-9 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">{error}</p>
          ) : null}
        </div>

        {/* Input */}
        <form
          className="flex items-center gap-2 border-t border-slate-100 bg-white/80 p-3 sm:p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your answer…"
            className="w-full rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </form>
      </div>

      <p className="mt-3 text-center text-xs text-slate-500">
        Not medical advice. Prefer a form?{" "}
        <Link className="font-medium text-rose-700 underline decoration-rose-200 underline-offset-2" href="/search">
          Typed search
        </Link>{" "}
        ·{" "}
        <Link className="font-medium text-rose-700 underline decoration-rose-200 underline-offset-2" href="/fhir">
          Import FHIR
        </Link>
      </p>
    </div>
  );
}
