"use client";

import { useEffect, useState } from "react";
import type { EvalResult, EvalRow, AggregateMetrics, ReliabilityRow, MethodVerdict } from "@/eval/harness";

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function fmtScore(v: MethodVerdict | null): string {
  if (!v) return "—";
  return `${v.score} · ${v.label}`;
}

function labelChip(label: string): string {
  if (label === "possible") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (label === "unlikely") return "bg-red-50 text-red-800 ring-red-200";
  return "bg-amber-50 text-amber-900 ring-amber-200";
}

function Stat({
  value,
  label,
  hint,
}: {
  value: string;
  label: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white/80 p-3.5">
      <p className="text-2xl font-bold leading-tight text-slate-900">{value}</p>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

function MethodCard({ title, m, accent }: { title: string; m: AggregateMetrics; accent: string }) {
  return (
    <section className={`rounded-2xl border ${accent} bg-white/90 p-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6`}>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-xs text-slate-500">N = {m.n} (excluding borderline)</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat value={pct(m.accuracy)} label="Accuracy" hint={`${m.tp + m.tn}/${m.n} correct`} />
        <Stat value={pct(m.f1)} label="F1 score" hint="balance of precision & recall" />
        <Stat value={pct(m.precision)} label="Precision" hint={`${m.tp}/${m.tp + m.fp} surfaced were real`} />
        <Stat value={pct(m.recall)} label="Recall" hint={`${m.tp}/${m.tp + m.fn} real matches surfaced`} />
      </div>
      <div className="mt-4 rounded-xl bg-slate-50 p-3.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Exclusion-catch rate</p>
        <p className="mt-0.5 text-xl font-bold text-slate-900">
          {pct(m.exclusionCatchRate)}{" "}
          <span className="text-sm font-medium text-slate-500">
            ({m.exclusionCaught}/{m.exclusionTotal} caught)
          </span>
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          % of cases with an explicit exclusion that this method actively labeled <span className="font-semibold">unlikely</span>.
        </p>
      </div>
      <div className="mt-3 rounded-xl bg-slate-50 p-3.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Score separation</p>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-xl font-bold text-slate-900">+{Math.round(m.scoreSeparation)}</p>
          <p className="text-sm text-slate-500">
            (matches {Math.round(m.meanScoreAppropriate)} vs non {Math.round(m.meanScoreInappropriate)})
          </p>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          Mean score gap between true matches and non-matches. Bigger = better discrimination.
        </p>
      </div>
    </section>
  );
}

export default function EvaluationPage() {
  const [running, setRunning] = useState(false);
  const [includeReliability, setIncludeReliability] = useState(false);
  const [result, setResult] = useState<EvalResult | null>(null);
  const [reliability, setReliability] = useState<ReliabilityRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Optional auto-run via ?autorun=1 — used for the docs screenshot capture.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("autorun") === "1") {
      void run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
    setReliability(null);
    try {
      const url = `/api/eval/run${includeReliability ? "?reliability=1" : ""}`;
      const res = await fetch(url);
      const data: unknown = await res.json();
      if (!res.ok) {
        setError(
          data && typeof data === "object" && "error" in data
            ? String((data as { error: unknown }).error)
            : "Eval failed",
        );
        return;
      }
      const d = data as { evaluation: EvalResult; reliability: ReliabilityRow[] | null };
      setResult(d.evaluation);
      setReliability(d.reliability);
    } catch {
      setError("Could not reach the eval API.");
    } finally {
      setRunning(false);
    }
  }

  const failuresKeyword = result?.rows.filter((r) => r.keywordCorrect === false) ?? [];
  const failuresAi = result?.rows.filter((r) => r.aiCorrect === false) ?? [];

  return (
    <div className="min-h-screen">
      <div className="border-b border-slate-200/80 bg-white/70 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-600">Evaluation &amp; evidence</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Does Gemini beat keyword matching?
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
            A hand-labeled benchmark of {15} patient-trial pairs runs the same workload through both the keyword
            heuristic and Gemini, then compares accuracy, F1, and the headline metric:{" "}
            <span className="font-semibold text-slate-900">exclusion-catch rate</span> — whether each method correctly
            rules out trials that explicitly exclude the patient.
          </p>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-500">
            See the full methodology, limitations, and citations in{" "}
            <a
              href="https://github.com/sienaro/ClinicalTrialTracker/blob/main/EVALUATION.md"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-rose-700 underline decoration-rose-200 underline-offset-2"
            >
              EVALUATION.md
            </a>
            .
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
        {/* CTA */}
        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-rose-100 bg-white/80 p-5 shadow-sm ring-1 ring-rose-100 sm:p-6">
          <button
            type="button"
            onClick={() => void run()}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {running ? (
              <>
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/80 [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/80 [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/80" />
                </span>
                Running benchmark…
              </>
            ) : (
              "Run benchmark"
            )}
          </button>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={includeReliability}
              onChange={(e) => setIncludeReliability(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
            />
            Include reliability check (Gemini run-to-run variance, slower)
          </label>
          <span className="ml-auto text-xs text-slate-500">
            ~15 Gemini calls per run · ~10-20 seconds
          </span>
        </section>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>
        ) : null}

        {result ? (
          <>
            {result.aiUnavailableReason ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                AI ranking unavailable: {result.aiUnavailableReason} (showing keyword-only results).
              </p>
            ) : null}

            {/* Summary cards */}
            <section className="grid gap-5 lg:grid-cols-2">
              <MethodCard title="Keyword heuristic" m={result.keyword} accent="border-slate-200" />
              {result.ai ? (
                <MethodCard title="Gemini AI" m={result.ai} accent="border-rose-200" />
              ) : null}
            </section>

            {/* Per-case table */}
            <section>
              <h2 className="mb-3 text-lg font-semibold text-slate-900">Per-case verdicts</h2>
              <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm ring-1 ring-slate-900/5">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Case</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Truth</th>
                      <th className="px-3 py-2">Keyword</th>
                      <th className="px-3 py-2">Gemini</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.rows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-slate-900">{row.id}</p>
                          <p className="text-xs text-slate-500">{row.patient}</p>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            {row.category}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${
                              row.groundTruth === "appropriate"
                                ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                                : row.groundTruth === "inappropriate"
                                  ? "bg-red-50 text-red-800 ring-red-200"
                                  : "bg-slate-100 text-slate-700 ring-slate-200"
                            }`}
                          >
                            {row.groundTruth}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <Verdict v={row.keyword} correct={row.keywordCorrect} />
                        </td>
                        <td className="px-3 py-2.5">
                          <Verdict v={row.ai} correct={row.aiCorrect} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Failure analysis */}
            {failuresKeyword.length > 0 || failuresAi.length > 0 ? (
              <section className="grid gap-5 lg:grid-cols-2">
                <FailureList title="Keyword got these wrong" rows={failuresKeyword} pick="keyword" />
                <FailureList title="Gemini got these wrong" rows={failuresAi} pick="ai" />
              </section>
            ) : null}

            {/* Reliability */}
            {reliability && reliability.length > 0 ? (
              <section>
                <h2 className="mb-2 text-lg font-semibold text-slate-900">Gemini reliability</h2>
                <p className="mb-3 text-sm text-slate-600">
                  Each fixture below was run 3 times to quantify run-to-run variance. Labels agreeing on every run is the
                  strongest form of consistency.
                </p>
                <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm ring-1 ring-slate-900/5">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Case</th>
                        <th className="px-3 py-2">Scores</th>
                        <th className="px-3 py-2">Mean</th>
                        <th className="px-3 py-2">Stdev</th>
                        <th className="px-3 py-2">Labels agree?</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reliability.map((r) => (
                        <tr key={r.id}>
                          <td className="px-3 py-2.5 font-medium text-slate-900">{r.id}</td>
                          <td className="px-3 py-2.5 text-slate-700">{r.scores.join(", ") || "—"}</td>
                          <td className="px-3 py-2.5 text-slate-700">{r.mean.toFixed(1)}</td>
                          <td className="px-3 py-2.5 text-slate-700">{r.stdev.toFixed(1)}</td>
                          <td className="px-3 py-2.5">
                            {r.labelAgreement ? (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                                ✓ Same label
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
                                Disagreed
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
          </>
        ) : !running ? (
          <section className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-12 text-center shadow-sm ring-1 ring-slate-900/5">
            <p className="text-sm font-medium text-slate-800">Run the benchmark to see results</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              The eval is computed live on every click — no canned numbers — so you&apos;ll see exactly how the current
              Gemini model and the keyword baseline perform today.
            </p>
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200/70 bg-white/60 p-5 text-xs leading-relaxed text-slate-600 sm:p-6">
          <p className="font-semibold text-slate-900">Honest limitations</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Small sample size ({"~"}15 fixtures), single evaluator. Not a clinical gold standard.</li>
            <li>
              Fixtures are <span className="font-medium">designed</span> to be unambiguous — they intentionally surface
              keyword weaknesses on exclusion criteria. Real ClinicalTrials.gov text is messier.
            </li>
            <li>Gemini is stochastic; repeated runs may vary. The reliability check makes that visible.</li>
            <li>
              See{" "}
              <a
                href="https://github.com/sienaro/ClinicalTrialTracker/blob/main/EVALUATION.md"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-rose-700 underline decoration-rose-200 underline-offset-2"
              >
                EVALUATION.md
              </a>{" "}
              for full methodology, citations, and discussion.
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}

function Verdict({ v, correct }: { v: MethodVerdict | null; correct: boolean | null }) {
  if (!v) return <span className="text-xs text-slate-400">—</span>;
  return (
    <div className="flex items-center gap-2">
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${labelChip(v.label)}`}>
        {fmtScore(v)}
      </span>
      {correct === true ? (
        <span aria-label="Correct" title="Correct" className="text-emerald-600">
          ✓
        </span>
      ) : correct === false ? (
        <span aria-label="Wrong" title="Wrong" className="text-red-600">
          ✗
        </span>
      ) : null}
    </div>
  );
}

function FailureList({ title, rows, pick }: { title: string; rows: EvalRow[]; pick: "keyword" | "ai" }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/40 p-5 sm:p-6">
      <h3 className="text-base font-semibold text-red-900">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-red-900/80">No misses on this run. 🎉</p>
      ) : (
        <ul className="mt-3 space-y-3 text-sm text-slate-700">
          {rows.map((r) => {
            const v = pick === "keyword" ? r.keyword : r.ai;
            return (
              <li key={r.id} className="rounded-lg border border-red-100 bg-white p-3">
                <p className="font-medium text-slate-900">{r.id}</p>
                <p className="text-xs text-slate-600">{r.patient}</p>
                <p className="mt-1 text-xs">
                  <span className="font-semibold text-slate-700">Truth:</span> {r.groundTruth} ·{" "}
                  <span className="font-semibold text-slate-700">Said:</span> {v ? fmtScore(v) : "—"}
                </p>
                <p className="mt-1 text-xs text-slate-600">{r.rationale}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
