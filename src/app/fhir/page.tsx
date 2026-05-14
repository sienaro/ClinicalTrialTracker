"use client";

import { useCallback, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { extractFhirTrialPrefill, type FhirTrialPrefillExtraction } from "@/lib/fhirClinicalContext";
import { saveProfilePrefill } from "@/lib/profilePrefill";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

type Step = "upload" | "confirm";

export default function FhirImportPage() {
  const router = useRouter();
  const fileId = useId();
  const [step, setStep] = useState<Step>("upload");
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [gapCondition, setGapCondition] = useState("");
  const [lastExtraction, setLastExtraction] = useState<FhirTrialPrefillExtraction | null>(null);

  const parseJson = useCallback((): unknown => {
    const raw = jsonText.trim();
    if (!raw) {
      throw new Error("Paste FHIR JSON or upload a .json file first.");
    }
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error("Invalid JSON. Check the export for truncation or copy errors.");
    }
  }, [jsonText]);

  const analyze = useCallback(() => {
    setError(null);
    try {
      const parsed = parseJson();
      setLastExtraction(extractFhirTrialPrefill(parsed));
      setStep("confirm");
    } catch (e) {
      setLastExtraction(null);
      setError(e instanceof Error ? e.message : "Could not parse JSON.");
    }
  }, [parseJson]);

  const backToUpload = () => {
    setStep("upload");
    setLastExtraction(null);
    setError(null);
  };

  const confirmAndSearch = () => {
    setError(null);
    let parsed: unknown;
    try {
      parsed = parseJson();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not parse JSON.");
      return;
    }

    const { prefill, summary } = extractFhirTrialPrefill(parsed);
    const gap = gapCondition.trim();
    if (summary.needsConditionFromUser && gap.length < 2) {
      setError("Enter a condition or topic below so we can query ClinicalTrials.gov.");
      return;
    }

    const merged = {
      ...prefill,
      ...(summary.needsConditionFromUser ? { condition: gap.slice(0, 120) } : {}),
      autoSearch: true,
    };
    saveProfilePrefill(merged);
    router.push("/search");
  };

  const notesPreview = lastExtraction?.prefill.sessionNotes;
  const notesTruncated = notesPreview && notesPreview.length > 6000;
  const notesShown = notesPreview ? notesPreview.slice(0, 6000) : "";

  return (
    <div className="min-h-screen bg-slate-50/50">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {step === "upload" ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Import</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">FHIR JSON bundle</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Upload or paste a FHIR R4-style JSON document (for example a Synthea patient bundle). Parsing runs in your
              browser only. After you analyze the file, you&apos;ll review what we extracted before any registry search
              runs.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Want to type a topic instead?{" "}
              <Link className="font-medium text-indigo-700 underline decoration-indigo-200 underline-offset-2" href="/search">
                Open typed search
              </Link>{" "}
              ·{" "}
              <Link className="font-medium text-slate-600 underline decoration-slate-300 underline-offset-2" href="/">
                Back to start
              </Link>
            </p>

            <div className="mt-8 space-y-5 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:p-8">
              <label className="grid gap-2 text-sm">
                <span className="font-medium text-slate-800">FHIR JSON</span>
                <textarea
                  className={`${inputClass} min-h-[220px] resize-y font-mono text-xs leading-relaxed`}
                  value={jsonText}
                  onChange={(e) => {
                    setJsonText(e.target.value);
                    setError(null);
                  }}
                  placeholder='{ "resourceType": "Bundle", "entry": [ ... ] }'
                  spellCheck={false}
                />
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <input
                  id={fileId}
                  type="file"
                  accept=".json,application/json"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    void f.text().then((t) => {
                      setJsonText(t);
                      setError(null);
                    });
                  }}
                />
                <label
                  htmlFor={fileId}
                  className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                >
                  Upload .json
                </label>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                  onClick={() => void analyze()}
                >
                  Analyze bundle
                </button>
              </div>

              {error ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p>
              ) : null}
            </div>
          </>
        ) : (
          lastExtraction && (
            <>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Confirm</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Review extracted data</h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                This is what we will send to the typed search screen and use for the first ClinicalTrials.gov query. If
                something looks wrong, go back and fix the JSON or adjust the fields below.
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Only the main topic is sent to the registry API; age, sex, and the condition list below are used on the
                next screen to rank and filter results locally.
              </p>

              <div className="mt-8 space-y-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:p-8">
                <dl className="grid gap-4 text-sm">
                  <div className="border-b border-slate-100 pb-4">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Registry search topic</dt>
                    <dd className="mt-1 text-lg font-semibold text-slate-900">
                      {lastExtraction.summary.primaryForRegistry ?? (
                        <span className="text-base font-normal text-amber-800">Not inferred from this file</span>
                      )}
                    </dd>
                    {lastExtraction.summary.primaryRaw &&
                    lastExtraction.summary.primaryRaw !== lastExtraction.summary.primaryForRegistry ? (
                      <dd className="mt-1 text-xs text-slate-500">Original code display: {lastExtraction.summary.primaryRaw}</dd>
                    ) : null}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Patient resource</dt>
                      <dd className="mt-1 font-medium text-slate-900">
                        {lastExtraction.summary.patientFound ? "Found" : "Not found"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active condition labels</dt>
                      <dd className="mt-1 font-medium text-slate-900">{lastExtraction.summary.activeConditionLabels}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Age (from birthDate)</dt>
                      <dd className="mt-1 font-medium text-slate-900">{lastExtraction.prefill.ageInput ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sex</dt>
                      <dd className="mt-1 font-medium text-slate-900">{lastExtraction.prefill.sex ?? "—"}</dd>
                    </div>
                  </div>

                  {notesPreview ? (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Context for local match scoring
                      </dt>
                      <dd className="mt-2">
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50/90 p-3 font-sans text-xs leading-relaxed text-slate-800">
                          {notesShown}
                          {notesTruncated ? "\n\n… (truncated in preview; full text is applied on confirm)" : ""}
                        </pre>
                      </dd>
                    </div>
                  ) : null}

                  {lastExtraction.summary.needsConditionFromUser ? (
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium text-slate-800">Condition or topic (required)</span>
                      <input
                        className={inputClass}
                        value={gapCondition}
                        onChange={(e) => setGapCondition(e.target.value)}
                        placeholder="e.g. breast cancer, type 2 diabetes"
                        autoComplete="off"
                      />
                    </label>
                  ) : null}
                </dl>

                {error ? (
                  <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p>
                ) : null}

                <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                    onClick={backToUpload}
                  >
                    Back to file
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                    onClick={confirmAndSearch}
                  >
                    Confirm and search trials
                  </button>
                </div>
              </div>
            </>
          )
        )}
      </main>
    </div>
  );
}
