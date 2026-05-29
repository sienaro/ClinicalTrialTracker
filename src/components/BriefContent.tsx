"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage, languageInstruction } from "@/components/LanguageProvider";
import { LanguageSelector } from "@/components/LanguageSelector";

type Explanation = {
  summary: string;
  goal: string;
  whatHappens: string[];
  whoFor: string;
};

type Fact = { label: string; value: string };

export function BriefContent({
  nctId,
  title,
  conditions,
  briefSummary,
  eligibilityText,
  url,
  facts,
  locationCount,
}: {
  nctId: string;
  title: string;
  conditions: string[];
  briefSummary: string;
  eligibilityText: string;
  url: string;
  facts: Fact[];
  locationCount: number;
}) {
  const { language, readingLevel } = useLanguage();
  const langInstr = languageInstruction(language, readingLevel);

  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [explRes, qRes] = await Promise.all([
          fetch("/api/trials/explain", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, briefSummary, eligibilityText, languageInstruction: langInstr }),
          }),
          fetch("/api/trials/questions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, briefSummary, eligibilityText, conditions: conditions.join(", "), languageInstruction: langInstr }),
          }),
        ]);
        if (cancelled) return;
        if (explRes.ok) {
          const d = (await explRes.json()) as { explanation: Explanation };
          setExplanation(d.explanation);
        }
        if (qRes.ok) {
          const d = (await qRes.json()) as { questions: string[] };
          setQuestions(Array.isArray(d.questions) ? d.questions : []);
        }
        if (!explRes.ok && !qRes.ok) setError("AI content requires a GEMINI_API_KEY. The fact sheet below still prints.");
      } catch {
        if (!cancelled) setError("Could not reach the AI service. The fact sheet below still prints.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [title, briefSummary, eligibilityText, conditions, langInstr]);

  return (
    <div className="min-h-screen">
      {/* Toolbar — hidden when printing */}
      <div className="no-print border-b border-slate-200/80 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            href={`/trial/${nctId}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-slate-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to trial
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <LanguageSelector compact />
            <button
              type="button"
              onClick={() => window.print()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:opacity-60"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              {loading ? "Preparing…" : "Print / Save as PDF"}
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {error ? (
          <p className="no-print mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</p>
        ) : null}

        <article className="print-page rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm ring-1 ring-slate-900/5 sm:p-10">
          {/* Letterhead */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-amber-600">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h4l2-6 4 12 2-6h6" />
                </svg>
              </span>
              <span className="text-sm font-bold text-slate-900">Clinical Trial Tracker</span>
            </div>
            <span className="text-xs font-medium text-slate-500">Trial brief · {nctId}</span>
          </div>

          <h1 className="mt-5 text-2xl font-bold leading-snug text-slate-900">{title}</h1>
          {conditions.length > 0 ? <p className="mt-1 text-sm text-slate-600">{conditions.join(" · ")}</p> : null}

          {/* Key facts */}
          <h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-rose-600">Key facts</h2>
          <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{f.label}</dt>
                <dd className="font-medium text-slate-900">{f.value}</dd>
              </div>
            ))}
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sites</dt>
              <dd className="font-medium text-slate-900">{locationCount > 0 ? `${locationCount} location(s)` : "—"}</dd>
            </div>
          </dl>

          {/* Plain-language explanation */}
          <h2 className="mt-7 text-sm font-bold uppercase tracking-wide text-rose-600">In plain language</h2>
          {loading ? (
            <div className="mt-2 space-y-2">
              <div className="skeleton h-3 w-full rounded" />
              <div className="skeleton h-3 w-4/5 rounded" />
            </div>
          ) : explanation ? (
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-700">
              <p>{explanation.summary}</p>
              <p><span className="font-semibold text-slate-900">Goal:</span> {explanation.goal}</p>
              {explanation.whatHappens?.length ? (
                <div>
                  <p className="font-semibold text-slate-900">What participation involves:</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {explanation.whatHappens.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              ) : null}
              <p><span className="font-semibold text-slate-900">Who it&apos;s for:</span> {explanation.whoFor}</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">{briefSummary || "No plain-language summary available."}</p>
          )}

          {/* Questions for the care team */}
          <h2 className="mt-7 text-sm font-bold uppercase tracking-wide text-rose-600">Questions to ask your care team</h2>
          {loading ? (
            <div className="mt-2 space-y-2">
              <div className="skeleton h-3 w-full rounded" />
              <div className="skeleton h-3 w-3/4 rounded" />
            </div>
          ) : questions.length > 0 ? (
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700 marker:font-semibold marker:text-rose-500">
              {questions.map((q, i) => <li key={i}>{q}</li>)}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No questions generated.</p>
          )}

          {/* Footer */}
          <div className="mt-8 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500">
            <p>
              Full study record:{" "}
              <span className="font-medium text-slate-700">{url}</span>
            </p>
            <p className="mt-1">
              This brief summarizes public ClinicalTrials.gov data with AI-generated explanations. It is not medical
              advice or a determination of eligibility. Confirm all details with the study team.
            </p>
          </div>
        </article>
      </main>
    </div>
  );
}
