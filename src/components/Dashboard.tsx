"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import type { Sex, TrialSummary } from "@/lib/clinicalTrialsGov";
import { consumeProfilePrefill } from "@/lib/profilePrefill";
import { scoreTrials, type ScoredTrial } from "@/lib/matchTrials";

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
  if (label === "possible") return "Stronger keyword / age fit";
  if (label === "unlikely") return "Weaker fit";
  return "Review on ClinicalTrials.gov";
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

  useEffect(() => {
    const prefill = consumeProfilePrefill();
    if (!prefill) return;
    if (prefill.condition !== undefined) setCondition(prefill.condition);
    if (prefill.ageInput !== undefined) setAgeInput(prefill.ageInput);
    if (prefill.sex !== undefined) setSex(prefill.sex);
    if (prefill.sessionNotes !== undefined) setSessionNotes(prefill.sessionNotes);

    const auto = prefill.autoSearch === true;
    const q = (prefill.condition ?? "").trim();
    if (!auto || q.length < 2) return;

    void (async () => {
      setError(null);
      setLoading(true);
      try {
        const { studies, nextPageToken } = await postTrialSearchPage({ condition: q, pageSize: 20 });
        setTrials(studies);
        setNextPageToken(nextPageToken);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    })();
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

  const scored = useMemo(() => {
    if (trials.length === 0) return [];
    return scoreTrials(trials, {
      condition,
      age,
      sex,
      referenceText: referenceText.trim() || undefined,
    });
  }, [trials, condition, age, sex, referenceText]);

  const displayedTrials = useMemo(() => {
    return scored.filter((t) => {
      if (hideSexConflict && t.matchSignals.sexConflict) return false;
      if (hideAgeOutside && t.matchSignals.ageLikelyOutside) return false;
      if (hideUnlikely && t.label === "unlikely") return false;
      return true;
    });
  }, [scored, hideSexConflict, hideAgeOutside, hideUnlikely]);

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
    try {
      const q = (opts?.conditionOverride ?? condition).trim();
      const { studies, nextPageToken } = await postTrialSearchPage({
        condition: q,
        pageSize: 20,
        pageToken: opts?.pageToken,
      });
      setTrials((prev) => (opts?.append ? [...prev, ...studies] : studies));
      setNextPageToken(nextPageToken);
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
          <div className="flex flex-col gap-2 border-b border-slate-100 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Profile &amp; context</h2>
              <p className="mt-1 max-w-xl text-sm text-slate-600">
                Used only in this tab to query the public registry and to score results locally. Clearing the tab clears
                everything.
              </p>
            </div>
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
        </section>

        <section className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Ranked studies</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              ClinicalTrials.gov is queried with your{" "}
              <span className="font-medium text-slate-800">main condition or topic only</span> (and recruiting
              status). Age, sex, and context notes—including the full FHIR problem list after import—are{" "}
              <span className="font-medium text-slate-800">not</span> sent as separate registry filters. They are used on
              this page to <span className="font-medium text-slate-800">re-rank and optionally filter</span> that
              result set using simple checks on eligibility text. This is exploratory, not formal qualification.
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
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-12 text-center shadow-sm ring-1 ring-slate-900/5 backdrop-blur-sm">
              <p className="text-sm font-medium text-slate-800">No studies to show yet</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
                Run a search to load trials. Examples: &quot;breast cancer&quot;, &quot;COPD&quot;, &quot;major depressive disorder&quot;.
              </p>
            </div>
          ) : displayedTrials.length === 0 ? (
            <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 px-6 py-10 text-center shadow-sm ring-1 ring-amber-900/5">
              <p className="text-sm font-medium text-amber-950">No trials match your filters</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-amber-900/80">
                Try turning off one or more options above, or run a broader main search topic.
              </p>
            </div>
          ) : (
            <ul className="grid gap-4">
              {displayedTrials.map((trial) => (
                <li
                  key={trial.nctId}
                  className="rounded-2xl border border-slate-200/90 bg-white/95 p-6 shadow-sm ring-1 ring-slate-900/5 transition hover:ring-indigo-200/80"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{trial.nctId}</p>
                      <h3 className="text-lg font-semibold leading-snug text-slate-900">{trial.title}</h3>
                      <p className="text-sm text-slate-600">
                        {trial.conditions.length > 0 ? trial.conditions.join(" · ") : "Conditions not listed"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${labelStyles(trial.label)}`}>
                        {labelText(trial.label)}
                      </span>
                      <span className="text-xs font-medium text-slate-500">Match score · {trial.score}/100</span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-slate-700">
                    <p className="font-medium text-slate-800">Why this rank</p>
                    <ul className="list-disc space-y-1 pl-5 marker:text-slate-400">
                      {trial.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-4">
                    <a
                      className="text-sm font-semibold text-indigo-700 underline decoration-indigo-200 underline-offset-2 hover:text-indigo-800"
                      href={trial.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View on ClinicalTrials.gov
                    </a>
                    <details className="text-sm text-slate-700">
                      <summary className="cursor-pointer font-semibold text-slate-800 hover:text-slate-950">
                        Eligibility criteria
                      </summary>
                      <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-xs text-slate-800">
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
    </div>
  );
}
