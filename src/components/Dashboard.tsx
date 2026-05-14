"use client";

import { useMemo, useState } from "react";
import type { Sex, TrialSummary } from "@/lib/clinicalTrialsGov";
import { scoreTrials, type ScoredTrial } from "@/lib/matchTrials";

function labelStyles(label: ScoredTrial["label"]) {
  if (label === "possible") return "bg-emerald-100 text-emerald-900 border border-emerald-200";
  if (label === "unlikely") return "bg-rose-100 text-rose-900 border border-rose-200";
  return "bg-amber-100 text-amber-900 border border-amber-200";
}

function labelText(label: ScoredTrial["label"]) {
  if (label === "possible") return "Demo: better keyword / age fit";
  if (label === "unlikely") return "Demo: weak fit";
  return "Demo: needs review";
}

export function Dashboard() {
  const [condition, setCondition] = useState("Type 2 diabetes");
  const [ageInput, setAgeInput] = useState("42");
  const [sex, setSex] = useState<Sex>("any");
  const [sessionNotes, setSessionNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trials, setTrials] = useState<TrialSummary[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();

  const age = useMemo(() => {
    const n = Number.parseInt(ageInput.trim(), 10);
    return Number.isFinite(n) ? n : undefined;
  }, [ageInput]);

  const scored = useMemo(() => {
    if (trials.length === 0) return [];
    return scoreTrials(trials, { condition, age, sex });
  }, [trials, condition, age, sex]);

  async function runSearch(opts?: { append?: boolean; pageToken?: string }) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/trials/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condition,
          pageSize: 20,
          pageToken: opts?.pageToken,
        }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        const msg =
          data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Search failed";
        throw new Error(msg);
      }
      if (!data || typeof data !== "object") throw new Error("Unexpected response");
      const studies = (data as { studies?: unknown }).studies;
      if (!Array.isArray(studies)) throw new Error("Unexpected response shape");
      const normalized = studies as TrialSummary[];
      const token =
        typeof (data as { nextPageToken?: unknown }).nextPageToken === "string"
          ? (data as { nextPageToken: string }).nextPageToken
          : undefined;

      setTrials((prev) => (opts?.append ? [...prev, ...normalized] : normalized));
      setNextPageToken(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="space-y-3">
        <p className="text-sm font-medium text-slate-600">Class project · synthetic testing only</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Find recruiting trials (demo ranking)
        </h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">Use only fake or public-domain practice data.</p>
          <p className="mt-2 text-amber-900/90">
            Nothing here is medical advice. Eligibility on{" "}
            <a className="underline" href="https://clinicaltrials.gov/">
              ClinicalTrials.gov
            </a>{" "}
            is official; this app only helps you browse faster for coursework. Profiles and notes stay in this browser
            tab until you refresh (they are not saved on the server).
          </p>
        </div>
      </header>

      <section className="grid gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Synthetic profile</h2>
          <p className="mt-1 text-sm text-slate-600">
            For a class build we keep uploads out of scope. Optional notes live only in memory in this tab.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-800">Primary condition keyword</span>
            <input
              className="rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              autoComplete="off"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-800">Age (optional, improves demo scoring)</span>
            <input
              inputMode="numeric"
              className="rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
              value={ageInput}
              onChange={(e) => setAgeInput(e.target.value)}
              autoComplete="off"
            />
          </label>

          <label className="grid gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-slate-800">Sex (demo text scan only)</span>
            <select
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
              value={sex}
              onChange={(e) => setSex(e.target.value as Sex)}
            >
              <option value="any">Prefer not to say / any</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-slate-800">Session notes (optional, not uploaded)</span>
            <textarea
              className="min-h-[96px] rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="e.g. practice scenario for class — still do not paste real medical records."
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            onClick={() => void runSearch()}
          >
            {loading ? "Searching…" : "Search recruiting trials"}
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading || !nextPageToken}
            onClick={() => void runSearch({ append: true, pageToken: nextPageToken })}
          >
            Load more
          </button>
        </div>

        {error ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Ranked results</h2>
            <p className="mt-1 text-sm text-slate-600">
              Pulled live from ClinicalTrials.gov (recruiting only). Scores are a classroom heuristic, not eligibility.
            </p>
          </div>
        </div>

        {scored.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            Run a search to see trials. Try conditions like &quot;breast cancer&quot;, &quot;asthma&quot;, or &quot;major depressive
            disorder&quot; using only synthetic profiles.
          </p>
        ) : (
          <ul className="grid gap-4">
            {scored.map((trial) => (
              <li
                key={trial.nctId}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{trial.nctId}</p>
                    <h3 className="text-lg font-semibold text-slate-900">{trial.title}</h3>
                    <p className="text-sm text-slate-600">
                      {trial.conditions.length > 0 ? trial.conditions.join(" · ") : "Conditions not listed"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${labelStyles(trial.label)}`}>
                      {labelText(trial.label)}
                    </span>
                    <span className="text-xs font-medium text-slate-500">Demo score: {trial.score}/100</span>
                  </div>
                </div>

                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p className="font-medium text-slate-800">Why this ranking (demo):</p>
                  <ul className="list-disc space-y-1 pl-5">
                    {trial.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    className="text-sm font-semibold text-blue-700 underline"
                    href={trial.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open official record
                  </a>
                  <details className="text-sm text-slate-700">
                    <summary className="cursor-pointer font-semibold text-slate-800">Eligibility excerpt</summary>
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-800">
                      {trial.eligibilityText || "No eligibility text returned."}
                    </pre>
                  </details>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
