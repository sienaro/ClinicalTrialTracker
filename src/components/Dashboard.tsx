"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { Sex, TrialSummary } from "@/lib/clinicalTrialsGov";
import { consumeProfilePrefill } from "@/lib/profilePrefill";
import { scoreTrials, computeMatchSignals, type ScoredTrial, type MatchLabel } from "@/lib/matchTrials";
import { ScoreRing } from "@/components/ScoreRing";
import { HealthSummaryPanel } from "@/components/HealthSummaryPanel";
import { useToast } from "@/components/Toast";

type AiResult = { score: number; label: MatchLabel; reasons: string[] };

const MAX_FILES = 10;
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_REFERENCE_CHARS = 28_000;
const PER_TEXT_FILE_CHARS = 10_000;

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".csv", ".tsv", ".json", ".log", ".xml"]);

function labelStyles(label: ScoredTrial["label"]) {
  if (label === "possible") return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80";
  if (label === "unlikely") return "bg-rose-50 text-rose-900 ring-1 ring-rose-200/80";
  return "bg-amber-50 text-amber-950 ring-1 ring-amber-200/80";
}

function labelText(label: ScoredTrial["label"]) {
  if (label === "possible") return "Stronger fit";
  if (label === "unlikely") return "Weaker fit";
  return "Worth a review";
}

function labelAccent(label: ScoredTrial["label"]) {
  if (label === "possible") return "border-l-emerald-400";
  if (label === "unlikely") return "border-l-rose-400";
  return "border-l-amber-400";
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

type Attachment = {
  id: string;
  name: string;
  size: number;
  kind: "text" | "binary";
  /** Extracted plain text for local ranking context only */
  extractedText?: string;
};

function isTextFile(file: File): boolean {
  const ext = extensionOf(file.name);
  if (TEXT_EXTENSIONS.has(ext)) return true;
  const t = file.type.toLowerCase();
  return t.startsWith("text/") || t === "application/json" || t === "application/xml";
}

async function readAttachment(file: File): Promise<Pick<Attachment, "kind" | "extractedText">> {
  if (!isTextFile(file)) {
    return { kind: "binary" };
  }
  const text = await file.text();
  const slice = text.slice(0, PER_TEXT_FILE_CHARS);
  return { kind: "text", extractedText: slice };
}

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

async function postTrialSearchPage(params: {
  condition: string;
  pageSize?: number;
  pageToken?: string;
}): Promise<{ studies: TrialSummary[]; nextPageToken?: string }> {
  const res = await fetch("/api/trials/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      condition: params.condition,
      pageSize: params.pageSize ?? 20,
      pageToken: params.pageToken,
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
  const token =
    typeof (data as { nextPageToken?: unknown }).nextPageToken === "string"
      ? (data as { nextPageToken: string }).nextPageToken
      : undefined;
  return { studies: studies as TrialSummary[], nextPageToken: token };
}

export function Dashboard() {
  const uploadId = useId();

  const [condition, setCondition] = useState("Type 2 diabetes");
  const [ageInput, setAgeInput] = useState("42");
  const [sex, setSex] = useState<Sex>("any");
  const [sessionNotes, setSessionNotes] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploadHint, setUploadHint] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trials, setTrials] = useState<TrialSummary[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();

  const [hideSexConflict, setHideSexConflict] = useState(false);
  const [hideAgeOutside, setHideAgeOutside] = useState(false);
  const [hideUnlikely, setHideUnlikely] = useState(false);

  const [aiRanked, setAiRanked] = useState<Map<string, AiResult> | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const { status: authStatus } = useSession();
  const loggedIn = authStatus === "authenticated";
  const toast = useToast();
  const prefilledRef = useRef(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // nctId -> { id, status } for trials this user has saved.
  const [savedMap, setSavedMap] = useState<Map<string, { id: string; status: string }>>(new Map());
  const [savingNct, setSavingNct] = useState<string | null>(null);

  useEffect(() => {
    const prefill = consumeProfilePrefill();
    if (!prefill) return;
    prefilledRef.current = true;
    if (prefill.condition !== undefined) setCondition(prefill.condition);
    if (prefill.ageInput !== undefined) setAgeInput(prefill.ageInput);
    if (prefill.sex !== undefined) setSex(prefill.sex);
    if (prefill.sessionNotes !== undefined) setSessionNotes(prefill.sessionNotes);

    const auto = prefill.autoSearch === true;
    const q = (prefill.condition ?? "").trim();
    if (!auto || q.length < 2) return;

    const rawAge = prefill.ageInput ? Number.parseInt(prefill.ageInput, 10) : undefined;
    const prefillAge = rawAge !== undefined && Number.isFinite(rawAge) ? rawAge : undefined;

    void (async () => {
      setError(null);
      setLoading(true);
      setAiRanked(null);
      try {
        const { studies, nextPageToken } = await postTrialSearchPage({ condition: q, pageSize: 20 });
        setTrials(studies);
        setNextPageToken(nextPageToken);
        void rankWithAI(studies, {
          condition: q,
          age: prefillAge,
          sex: (prefill.sex ?? "any") as Sex,
          sessionNotes: prefill.sessionNotes?.trim() || undefined,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the saved profile for logged-in users, unless a FHIR import prefilled the form.
  useEffect(() => {
    if (authStatus !== "authenticated" || prefilledRef.current) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) return;
        const data: unknown = await res.json();
        const profile =
          data && typeof data === "object" ? (data as { profile?: unknown }).profile : null;
        if (cancelled || !profile || typeof profile !== "object") return;
        const p = profile as { condition?: string; ageInput?: string; sex?: string; sessionNotes?: string };
        if (p.condition) setCondition(p.condition);
        if (p.ageInput) setAgeInput(p.ageInput);
        if (p.sex === "male" || p.sex === "female" || p.sex === "any") setSex(p.sex);
        if (p.sessionNotes) setSessionNotes(p.sessionNotes);
      } catch {
        /* ignore — fall back to defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  const saveProfile = useCallback(async () => {
    setProfileSaving(true);
    setProfileSaved(false);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ condition, ageInput, sex, sessionNotes }),
      });
      if (res.ok) {
        setProfileSaved(true);
        toast("Profile saved to your account");
        setTimeout(() => setProfileSaved(false), 2500);
      } else {
        toast("Could not save profile", "error");
      }
    } finally {
      setProfileSaving(false);
    }
  }, [condition, ageInput, sex, sessionNotes, toast]);

  // Load which trials are already saved (logged-in users).
  useEffect(() => {
    if (authStatus !== "authenticated") {
      setSavedMap(new Map());
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/saved-trials");
        if (!res.ok) return;
        const data: unknown = await res.json();
        const trials =
          data && typeof data === "object" ? (data as { trials?: unknown }).trials : null;
        if (cancelled || !Array.isArray(trials)) return;
        const next = new Map<string, { id: string; status: string }>();
        for (const t of trials) {
          if (t && typeof t === "object") {
            const row = t as { id?: string; nctId?: string; status?: string };
            if (row.id && row.nctId) next.set(row.nctId, { id: row.id, status: row.status ?? "interested" });
          }
        }
        setSavedMap(next);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  const saveTrial = useCallback(async (trial: ScoredTrial) => {
    setSavingNct(trial.nctId);
    try {
      const res = await fetch("/api/saved-trials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nctId: trial.nctId,
          title: trial.title,
          conditions: trial.conditions,
          eligibilityText: trial.eligibilityText,
          url: trial.url,
          score: trial.score,
          label: trial.label,
          reasons: trial.reasons,
        }),
      });
      if (!res.ok) {
        toast("Could not save trial", "error");
        return;
      }
      const data = (await res.json()) as { id: string; status: string };
      setSavedMap((prev) => new Map(prev).set(trial.nctId, { id: data.id, status: data.status }));
      toast("Saved to your trials");
    } finally {
      setSavingNct(null);
    }
  }, [toast]);

  const unsaveTrial = useCallback(async (nctId: string, id: string) => {
    setSavingNct(nctId);
    try {
      const res = await fetch(`/api/saved-trials/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      setSavedMap((prev) => {
        const next = new Map(prev);
        next.delete(nctId);
        return next;
      });
      toast("Removed from saved", "info");
    } finally {
      setSavingNct(null);
    }
  }, [toast]);

  const updateSavedStatus = useCallback(async (nctId: string, id: string, status: string) => {
    setSavedMap((prev) => new Map(prev).set(nctId, { id, status }));
    await fetch(`/api/saved-trials/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }, []);

  const age = useMemo(() => {
    const n = Number.parseInt(ageInput.trim(), 10);
    return Number.isFinite(n) ? n : undefined;
  }, [ageInput]);

  const referenceText = useMemo(() => {
    const fromFiles = attachments
      .map((a) => a.extractedText)
      .filter(Boolean)
      .join("\n\n");
    const merged = [sessionNotes.trim(), fromFiles].filter(Boolean).join("\n\n");
    return merged.slice(0, MAX_REFERENCE_CHARS);
  }, [attachments, sessionNotes]);

  const scored = useMemo<ScoredTrial[]>(() => {
    if (trials.length === 0) return [];
    if (aiRanked && aiRanked.size > 0) {
      return trials
        .map((trial): ScoredTrial => {
          const ai = aiRanked.get(trial.nctId);
          const matchSignals = computeMatchSignals(trial, { age, sex });
          if (ai) {
            return { ...trial, score: ai.score, label: ai.label, reasons: ai.reasons, matchSignals };
          }
          const [fb] = scoreTrials([trial], { condition, age, sex });
          return fb!;
        })
        .sort((a, b) => b.score - a.score);
    }
    return scoreTrials(trials, { condition, age, sex, referenceText: referenceText.trim() || undefined });
  }, [trials, aiRanked, condition, age, sex, referenceText]);

  const displayedTrials = useMemo(() => {
    return scored.filter((t) => {
      if (hideSexConflict && t.matchSignals.sexConflict) return false;
      if (hideAgeOutside && t.matchSignals.ageLikelyOutside) return false;
      if (hideUnlikely && t.label === "unlikely") return false;
      return true;
    });
  }, [scored, hideSexConflict, hideAgeOutside, hideUnlikely]);

  const stats = useMemo(() => {
    const s = { possible: 0, unclear: 0, unlikely: 0 };
    for (const t of displayedTrials) s[t.label] += 1;
    return s;
  }, [displayedTrials]);

  const ingestFiles = useCallback(
    async (list: FileList | File[]) => {
      setUploadHint(null);
      const incoming = Array.from(list);
      if (incoming.length === 0) return;

      const room = MAX_FILES - attachments.length;
      if (room <= 0) {
        setUploadHint(`You can attach up to ${MAX_FILES} files. Remove one to add another.`);
        return;
      }

      const toProcess = incoming.slice(0, room);
      const next: Attachment[] = [];

      for (const file of toProcess) {
        if (file.size > MAX_FILE_BYTES) {
          setUploadHint(`“${file.name}” exceeds ${formatBytes(MAX_FILE_BYTES)} and was skipped.`);
          continue;
        }
        try {
          const { kind, extractedText } = await readAttachment(file);
          next.push({
            id: crypto.randomUUID(),
            name: file.name,
            size: file.size,
            kind,
            extractedText,
          });
        } catch {
          setUploadHint(`Could not read “${file.name}”. Try a different format.`);
        }
      }

      if (next.length > 0) {
        setAttachments((prev) => [...prev, ...next]);
      }
    },
    [attachments.length],
  );

  const rankWithAI = useCallback(
    async (
      trialsToRank: TrialSummary[],
      profile: { condition: string; age?: number; sex: Sex; sessionNotes?: string },
    ) => {
      if (trialsToRank.length === 0) return;
      setAiLoading(true);
      setAiError(null);
      try {
        const res = await fetch("/api/trials/rank", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile, trials: trialsToRank }),
        });
        const data: unknown = await res.json();
        if (!res.ok) {
          const msg =
            data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
              ? (data as { error: string }).error
              : "AI ranking failed";
          setAiError(msg);
          return;
        }
        const ranked = (data as { ranked: Array<{ nctId: string } & AiResult> }).ranked;
        setAiRanked(new Map(ranked.map((r) => [r.nctId, { score: r.score, label: r.label, reasons: r.reasons }])));
      } catch (e) {
        setAiError(e instanceof Error ? e.message : "AI ranking unavailable");
      } finally {
        setAiLoading(false);
      }
    },
    [],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      void ingestFiles(e.dataTransfer.files);
    },
    [ingestFiles],
  );

  async function runSearch(opts?: { append?: boolean; pageToken?: string; conditionOverride?: string }) {
    setError(null);
    setLoading(true);
    if (!opts?.append) setAiRanked(null);
    try {
      const q = (opts?.conditionOverride ?? condition).trim();
      const { studies, nextPageToken } = await postTrialSearchPage({
        condition: q,
        pageSize: 20,
        pageToken: opts?.pageToken,
      });
      const allStudies = opts?.append ? [...trials, ...studies] : studies;
      setTrials(allStudies);
      setNextPageToken(nextPageToken);
      void rankWithAI(allStudies, { condition: q, age, sex, sessionNotes: sessionNotes.trim() || undefined });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const textAttachmentCount = attachments.filter((a) => a.kind === "text").length;

  return (
    <div className="min-h-screen">
      <div className="border-b border-slate-200/80 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-8 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Clinical research</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Clinical Trial Tracker
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Search recruiting studies from{" "}
            <a className="font-medium text-indigo-700 underline decoration-indigo-300 underline-offset-2" href="https://clinicaltrials.gov/">
              ClinicalTrials.gov
            </a>
            . Everything below stays in this browser tab. To start from a FHIR file instead, use{" "}
            <Link className="font-medium text-indigo-700 underline decoration-indigo-300 underline-offset-2" href="/fhir">
              Import
            </Link>{" "}
            or{" "}
            <Link className="font-medium text-slate-700 underline decoration-slate-300 underline-offset-2" href="/">
              Start
            </Link>
            .
          </p>
        </div>
      </div>

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
        <aside className="rounded-xl border border-slate-200/80 bg-white/90 p-5 text-sm leading-relaxed text-slate-700 shadow-sm ring-1 ring-slate-900/5 backdrop-blur-sm sm:p-6">
          <p className="font-medium text-slate-900">Important</p>
          <p className="mt-2 text-slate-600">
            This tool does not provide medical advice. Official eligibility criteria always live on{" "}
            <a className="font-medium text-indigo-700 underline decoration-indigo-200 underline-offset-2" href="https://clinicaltrials.gov/">
              ClinicalTrials.gov
            </a>
            . Match scores are an exploratory heuristic to prioritize reading—not a determination of qualification.
            Avoid uploading highly sensitive personal health information unless you accept the residual risk of keeping it
            in this tab&apos;s memory.
          </p>
        </aside>

        <section className="grid gap-8 rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-sm ring-1 ring-slate-900/5 backdrop-blur-sm sm:p-8">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Profile &amp; context</h2>
              <p className="mt-1 max-w-xl text-sm text-slate-600">
                {loggedIn
                  ? "Saved to your account so it's here next time. Used to query the registry and rank results."
                  : "Used only in this tab to query the registry and rank results. Log in to save it to your account."}
              </p>
            </div>
            {loggedIn ? (
              <div className="flex items-center gap-2">
                {profileSaved ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Saved
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => void saveProfile()}
                  disabled={profileSaving}
                  className="inline-flex items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {profileSaving ? "Saving…" : "Save to my profile"}
                </button>
              </div>
            ) : (
              <Link
                href="/login?callbackUrl=/search"
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Log in to save
              </Link>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-slate-800">Condition or topic</span>
              <input
                className={inputClass}
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                autoComplete="off"
              />
            </label>

            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-slate-800">Age (optional)</span>
              <input
                inputMode="numeric"
                className={inputClass}
                value={ageInput}
                onChange={(e) => setAgeInput(e.target.value)}
                autoComplete="off"
              />
            </label>

            <label className="grid gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium text-slate-800">Sex (quick eligibility text scan)</span>
              <select
                className={inputClass}
                value={sex}
                onChange={(e) => setSex(e.target.value as Sex)}
              >
                <option value="any">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </label>

            <label className="grid gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium text-slate-800">Context notes (optional)</span>
              <textarea
                className={`${inputClass} min-h-[100px] resize-y`}
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="Medications, prior lines of therapy, inclusion goals—kept locally for this session."
              />
            </label>
          </div>

          <div className="grid gap-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Supporting documents</h3>
                <p className="text-xs text-slate-500 sm:text-sm">
                  Drag files here or browse. Plain text formats are parsed in-browser for keyword overlap; other types
                  stay listed as attachments only.
                </p>
              </div>
              {attachments.length > 0 ? (
                <button
                  type="button"
                  className="self-start text-xs font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                  onClick={() => {
                    setAttachments([]);
                    setUploadHint(null);
                  }}
                >
                  Remove all files
                </button>
              ) : null}
            </div>

            <input
              id={uploadId}
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => {
                const files = e.target.files;
                if (files) void ingestFiles(files);
                e.target.value = "";
              }}
            />

            <label
              htmlFor={uploadId}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setDragOver(false);
              }}
              onDrop={onDrop}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition sm:py-12 ${
                dragOver
                  ? "border-indigo-400 bg-indigo-50/80 ring-2 ring-indigo-100"
                  : "border-slate-200 bg-slate-50/50 hover:border-indigo-300 hover:bg-indigo-50/40"
              }`}
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white shadow ring-1 ring-slate-200">
                <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" />
                </svg>
              </span>
              <span className="text-sm font-medium text-slate-800">Drop files to attach</span>
              <span className="text-xs text-slate-500">
                Click to browse · up to {MAX_FILES} files · {formatBytes(MAX_FILE_BYTES)} each
              </span>
              <span className="mt-2 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm">
                Choose files
              </span>
            </label>

            {uploadHint ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">{uploadHint}</p>
            ) : null}

            {attachments.length > 0 ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {attachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{a.name}</p>
                      <p className="text-xs text-slate-500">
                        {formatBytes(a.size)}
                        {a.kind === "text" ? " · Parsed as text" : " · Attachment only"}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label={`Remove ${a.name}`}
                      onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {textAttachmentCount > 0 ? (
              <p className="text-xs text-slate-500">
                Text from {textAttachmentCount} file{textAttachmentCount === 1 ? "" : "s"} is included in the local match
                heuristic (capped for performance).
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-6">
            <button
              type="button"
              className="inline-flex min-h-[42px] items-center justify-center rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
              onClick={() => void runSearch()}
            >
              {loading ? "Searching…" : "Search recruiting trials"}
            </button>
            <button
              type="button"
              className="inline-flex min-h-[42px] items-center justify-center rounded-lg border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading || !nextPageToken}
              onClick={() => void runSearch({ append: true, pageToken: nextPageToken })}
            >
              Load more results
            </button>
          </div>

          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p>
          ) : null}

          {aiLoading ? (
            <p className="animate-pulse text-xs font-medium text-indigo-600">
              Gemini AI is analyzing trial eligibility — results will update shortly…
            </p>
          ) : aiError ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              AI ranking unavailable ({aiError}). Showing keyword-based results instead.
            </p>
          ) : aiRanked ? (
            <p className="text-xs text-slate-500">Ranked by Gemini AI · {aiRanked.size} trials analyzed</p>
          ) : null}
        </section>

        <HealthSummaryPanel condition={condition} ageInput={ageInput} sex={sex} sessionNotes={sessionNotes} />

        <section className="space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Ranked studies</h2>
              {aiRanked && !aiLoading ? (
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-700/20">
                  AI-ranked by Gemini
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              ClinicalTrials.gov is queried with your{" "}
              <span className="font-medium text-slate-800">main condition or topic only</span> (and recruiting
              status). Age, sex, and context notes—including the full FHIR problem list after import—are{" "}
              <span className="font-medium text-slate-800">not</span> sent as separate registry filters. They are used
              by Gemini AI to <span className="font-medium text-slate-800">re-rank and optionally filter</span> that
              result set against eligibility criteria. This is exploratory, not formal qualification.
            </p>
          </div>

          {scored.length > 0 ? (
            <div className="rounded-xl border border-slate-200/90 bg-white/95 p-4 shadow-sm ring-1 ring-slate-900/5 sm:p-5">
              <p className="text-sm font-medium text-slate-900">Refine this list</p>
              <p className="mt-1 text-xs text-slate-500">
                Turn on filters to hide trials that look like weaker fits based on parsed eligibility text and your
                profile.
              </p>
              <div className="mt-3 flex flex-col gap-2.5 text-sm text-slate-800 sm:flex-row sm:flex-wrap sm:gap-x-6">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={hideUnlikely}
                    onChange={(e) => setHideUnlikely(e.target.checked)}
                  />
                  Hide &quot;unlikely&quot; matches
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={hideAgeOutside}
                    onChange={(e) => setHideAgeOutside(e.target.checked)}
                    disabled={age === undefined}
                  />
                  Hide age likely outside parsed range
                  {age === undefined ? (
                    <span className="text-xs text-slate-400">(add age)</span>
                  ) : null}
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={hideSexConflict}
                    onChange={(e) => setHideSexConflict(e.target.checked)}
                    disabled={sex === "any"}
                  />
                  Hide sex mismatch hints
                  {sex === "any" ? <span className="text-xs text-slate-400">(set sex)</span> : null}
                </label>
              </div>
            </div>
          ) : null}

          {scored.length === 0 ? (
            loading ? (
              <ul className="grid gap-4">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-sm ring-1 ring-slate-900/5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="w-full space-y-3">
                        <div className="skeleton h-3 w-24 rounded" />
                        <div className="skeleton h-5 w-3/4 rounded" />
                        <div className="skeleton h-3 w-1/2 rounded" />
                      </div>
                      <div className="skeleton h-16 w-16 shrink-0 rounded-full" />
                    </div>
                    <div className="mt-5 space-y-2">
                      <div className="skeleton h-3 w-full rounded" />
                      <div className="skeleton h-3 w-5/6 rounded" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-12 text-center shadow-sm ring-1 ring-slate-900/5 backdrop-blur-sm">
                <p className="text-sm font-medium text-slate-800">No studies to show yet</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
                  Run a search to load trials. Examples: &quot;breast cancer&quot;, &quot;COPD&quot;, &quot;major depressive disorder&quot;.
                </p>
              </div>
            )
          ) : displayedTrials.length === 0 ? (
            <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 px-6 py-10 text-center shadow-sm ring-1 ring-amber-900/5">
              <p className="text-sm font-medium text-amber-950">No trials match your filters</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-amber-900/80">
                Try turning off one or more options above, or run a broader main search topic.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {stats.possible} stronger fit
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  {stats.unclear} worth review
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800 ring-1 ring-rose-200">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  {stats.unlikely} weaker fit
                </span>
              </div>

              <ul className="grid gap-4">
                {displayedTrials.map((trial, i) => {
                  const saved = savedMap.get(trial.nctId);
                  return (
                  <li
                    key={trial.nctId}
                    style={{ animationDelay: `${Math.min(i * 50, 400)}ms` }}
                    className={`animate-fade-in-up rounded-2xl border border-l-4 border-slate-200/90 bg-white/95 p-6 shadow-sm ring-1 ring-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-indigo-200/80 ${labelAccent(trial.label)}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 space-y-1.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{trial.nctId}</p>
                        <h3 className="text-lg font-semibold leading-snug text-slate-900">{trial.title}</h3>
                        <p className="text-sm text-slate-600">
                          {trial.conditions.length > 0 ? trial.conditions.join(" · ") : "Conditions not listed"}
                        </p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${labelStyles(trial.label)}`}>
                            {labelText(trial.label)}
                          </span>
                          {trial.matchSignals.ageLikelyOutside ? (
                            <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
                              Age may be outside range
                            </span>
                          ) : null}
                          {trial.matchSignals.sexConflict ? (
                            <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
                              Sex mismatch hint
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <ScoreRing score={trial.score} label={trial.label} />
                    </div>

                    <div className="mt-4 space-y-2 text-sm text-slate-700">
                      <p className="flex items-center gap-1.5 font-medium text-slate-800">
                        {aiRanked ? (
                          <>
                            <svg className="h-3.5 w-3.5 text-indigo-500" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                              <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                            </svg>
                            Why Gemini ranked this
                          </>
                        ) : (
                          "Why this rank"
                        )}
                      </p>
                      <ul className="list-disc space-y-1 pl-5 marker:text-slate-400">
                        {trial.reasons.map((r, ri) => (
                          <li key={`${trial.nctId}-${ri}`}>{r}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-4">
                      <Link
                        href={`/trial/${trial.nctId}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                      >
                        View details &amp; ask AI
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                      <a
                        className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 underline decoration-indigo-200 underline-offset-2 hover:text-indigo-800"
                        href={trial.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        ClinicalTrials.gov
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5h5m0 0v5m0-5L10 14M5 9v10h10" />
                        </svg>
                      </a>
                      <details className="text-sm text-slate-700">
                        <summary className="cursor-pointer font-semibold text-slate-800 hover:text-slate-950">
                          Eligibility criteria
                        </summary>
                        <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-xs text-slate-800">
                          {trial.eligibilityText || "No eligibility text returned."}
                        </pre>
                      </details>

                      {loggedIn ? (
                        <div className="ml-auto flex items-center gap-2">
                          {saved ? (
                            <>
                              <select
                                value={saved.status}
                                onChange={(e) => void updateSavedStatus(trial.nctId, saved.id, e.target.value)}
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                aria-label="Saved status"
                              >
                                <option value="interested">Interested</option>
                                <option value="contacted">Contacted</option>
                                <option value="applied">Applied</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => void unsaveTrial(trial.nctId, saved.id)}
                                disabled={savingNct === trial.nctId}
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                              >
                                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                                  <path d="M5 3a2 2 0 00-2 2v16l9-4 9 4V5a2 2 0 00-2-2H5z" />
                                </svg>
                                Saved
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void saveTrial(trial)}
                              disabled={savingNct === trial.nctId}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-60"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3-7 3V5z" />
                              </svg>
                              {savingNct === trial.nctId ? "Saving…" : "Save"}
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
