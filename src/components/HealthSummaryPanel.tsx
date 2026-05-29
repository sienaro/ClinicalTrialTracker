"use client";

import { useState } from "react";
import type { Sex } from "@/lib/clinicalTrialsGov";
import { useLanguage, languageInstruction } from "@/components/LanguageProvider";

type HealthSummary = {
  overview: string;
  conditions: string[];
  demographics: string;
  considerations: string[];
};

const sparkle = (
  <svg className="h-4 w-4 text-rose-500" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
  </svg>
);

export function HealthSummaryPanel({
  condition,
  ageInput,
  sex,
  sessionNotes,
}: {
  condition: string;
  ageInput: string;
  sex: Sex;
  sessionNotes: string;
}) {
  const { language, readingLevel } = useLanguage();
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condition,
          ageInput,
          sex,
          sessionNotes,
          languageInstruction: languageInstruction(language, readingLevel),
        }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        setError(
          data && typeof data === "object" && "error" in data
            ? String((data as { error: unknown }).error)
            : "Could not generate summary.",
        );
        return;
      }
      setSummary((data as { summary: HealthSummary }).summary);
    } catch {
      setError("Could not reach the AI summarizer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/60 to-white p-5 shadow-sm ring-1 ring-rose-100 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {sparkle}
          <h3 className="text-base font-semibold text-slate-900">AI health snapshot</h3>
        </div>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Summarizing…" : summary ? "Regenerate" : "Generate snapshot"}
        </button>
      </div>

      <p className="mt-2 text-sm text-slate-600">
        Gemini organizes your condition and context notes into a clinical overview used to guide trial matching.
      </p>

      {error ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</p>
      ) : null}

      {loading ? (
        <div className="mt-4 space-y-2.5">
          <div className="skeleton h-3 w-full rounded" />
          <div className="skeleton h-3 w-4/5 rounded" />
          <div className="skeleton h-3 w-3/5 rounded" />
        </div>
      ) : summary ? (
        <div className="mt-4 space-y-3.5 text-sm leading-relaxed text-slate-700">
          <p>{summary.overview}</p>
          {summary.conditions?.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Identified conditions</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {summary.conditions.map((c) => (
                  <span key={c} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {summary.demographics ? (
            <p className="text-sm text-slate-600">{summary.demographics}</p>
          ) : null}
          {summary.considerations?.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Matching considerations</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 marker:text-rose-300">
                {summary.considerations.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-xs text-slate-400">AI-organized from your inputs. Not medical advice or a diagnosis.</p>
        </div>
      ) : null}
    </div>
  );
}
