"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ScoreRing } from "@/components/ScoreRing";
import type { MatchLabel } from "@/lib/matchTrials";

export type SavedTrialView = {
  id: string;
  nctId: string;
  title: string;
  conditions: string[];
  eligibilityText: string;
  url: string;
  score: number | null;
  label: string | null;
  reasons: string[];
  status: string;
  notes: string;
};

const STATUS_ORDER = ["interested", "contacted", "applied"] as const;
type Status = (typeof STATUS_ORDER)[number];

const STATUS_META: Record<Status, { title: string; blurb: string; dot: string; ring: string }> = {
  interested: { title: "Interested", blurb: "Saved to look into", dot: "bg-indigo-500", ring: "ring-indigo-200" },
  contacted: { title: "Contacted", blurb: "Reached out to the study team", dot: "bg-amber-500", ring: "ring-amber-200" },
  applied: { title: "Applied", blurb: "Submitted / screening", dot: "bg-emerald-500", ring: "ring-emerald-200" },
};

function asLabel(label: string | null): MatchLabel {
  return label === "possible" || label === "unlikely" || label === "unclear" ? label : "unclear";
}

export function SavedTrialsList({ initialTrials }: { initialTrials: SavedTrialView[] }) {
  const [trials, setTrials] = useState<SavedTrialView[]>(initialTrials);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialTrials.map((t) => [t.id, t.notes])),
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const g: Record<Status, SavedTrialView[]> = { interested: [], contacted: [], applied: [] };
    for (const t of trials) {
      const s = (STATUS_ORDER as readonly string[]).includes(t.status) ? (t.status as Status) : "interested";
      g[s].push(t);
    }
    return g;
  }, [trials]);

  async function setStatus(id: string, status: Status) {
    setTrials((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    await fetch(`/api/saved-trials/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function saveNotes(id: string) {
    setBusyId(id);
    try {
      const notes = noteDrafts[id] ?? "";
      const res = await fetch(`/api/saved-trials/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) setTrials((prev) => prev.map((t) => (t.id === id ? { ...t, notes } : t)));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/saved-trials/${id}`, { method: "DELETE" });
      if (res.ok) setTrials((prev) => prev.filter((t) => t.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="border-b border-slate-200/80 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-8 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Your pipeline</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Saved trials</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
            Track trials you&apos;ve saved as they move from interested to contacted to applied. Add private notes for
            questions to ask the study team.
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {trials.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-16 text-center shadow-sm ring-1 ring-slate-900/5 backdrop-blur-sm">
            <p className="text-sm font-medium text-slate-800">No saved trials yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              Search recruiting studies and hit <span className="font-semibold">Save</span> on the ones you want to
              track.
            </p>
            <Link
              href="/search"
              className="mt-5 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
            >
              Find trials
            </Link>
          </div>
        ) : (
          <div className="grid gap-8">
            {STATUS_ORDER.map((status) => {
              const meta = STATUS_META[status];
              const items = grouped[status];
              return (
                <section key={status}>
                  <div className="mb-3 flex items-center gap-2.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                    <h2 className="text-lg font-semibold text-slate-900">{meta.title}</h2>
                    <span className={`rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ${meta.ring}`}>
                      {items.length}
                    </span>
                    <span className="text-sm text-slate-500">· {meta.blurb}</span>
                  </div>

                  {items.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-white/50 px-4 py-6 text-center text-sm text-slate-400">
                      Nothing here yet.
                    </p>
                  ) : (
                    <ul className="grid gap-4">
                      {items.map((t) => {
                        const dirty = (noteDrafts[t.id] ?? "") !== t.notes;
                        return (
                          <li
                            key={t.id}
                            className="rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="min-w-0 space-y-1">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.nctId}</p>
                                <h3 className="text-base font-semibold leading-snug text-slate-900">{t.title}</h3>
                                <p className="text-sm text-slate-600">
                                  {t.conditions.length > 0 ? t.conditions.join(" · ") : "Conditions not listed"}
                                </p>
                              </div>
                              {typeof t.score === "number" ? (
                                <ScoreRing score={t.score} label={asLabel(t.label)} />
                              ) : null}
                            </div>

                            {t.reasons.length > 0 ? (
                              <details className="mt-3 text-sm text-slate-700">
                                <summary className="cursor-pointer font-semibold text-slate-800 hover:text-slate-950">
                                  Why it was ranked this way
                                </summary>
                                <ul className="mt-2 list-disc space-y-1 pl-5 marker:text-slate-400">
                                  {t.reasons.map((r, ri) => (
                                    <li key={`${t.id}-${ri}`}>{r}</li>
                                  ))}
                                </ul>
                              </details>
                            ) : null}

                            <div className="mt-4 grid gap-1.5">
                              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Your notes
                              </label>
                              <textarea
                                value={noteDrafts[t.id] ?? ""}
                                onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                                placeholder="Questions for the study team, eligibility doubts, next steps…"
                                className="min-h-[64px] w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                              />
                              {dirty ? (
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => void saveNotes(t.id)}
                                    disabled={busyId === t.id}
                                    className="self-start rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
                                  >
                                    {busyId === t.id ? "Saving…" : "Save note"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setNoteDrafts((prev) => ({ ...prev, [t.id]: t.notes }))}
                                    className="text-xs font-medium text-slate-500 hover:text-slate-800"
                                  >
                                    Discard
                                  </button>
                                </div>
                              ) : null}
                            </div>

                            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                              <label className="flex items-center gap-2 text-sm text-slate-700">
                                <span className="text-xs font-medium text-slate-500">Status</span>
                                <select
                                  value={t.status}
                                  onChange={(e) => void setStatus(t.id, e.target.value as Status)}
                                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                >
                                  <option value="interested">Interested</option>
                                  <option value="contacted">Contacted</option>
                                  <option value="applied">Applied</option>
                                </select>
                              </label>
                              <Link
                                href={`/trial/${t.nctId}`}
                                className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 underline decoration-indigo-200 underline-offset-2 hover:text-indigo-800"
                              >
                                Details &amp; AI
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </Link>
                              <a
                                className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-800"
                                href={t.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                ClinicalTrials.gov
                              </a>
                              <button
                                type="button"
                                onClick={() => void remove(t.id)}
                                disabled={busyId === t.id}
                                className="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 0v12a1 1 0 001 1h6a1 1 0 001-1V7" />
                                </svg>
                                Remove
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
