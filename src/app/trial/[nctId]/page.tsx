import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchStudyDetail } from "@/lib/clinicalTrialsGov";
import { TrialAiPanel } from "@/components/TrialAiPanel";

function statusStyle(status: string): string {
  const s = status.toUpperCase();
  if (s.includes("RECRUITING")) return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (s.includes("COMPLETED")) return "bg-slate-100 text-slate-700 ring-slate-200";
  if (s.includes("TERMINATED") || s.includes("WITHDRAWN") || s.includes("SUSPENDED"))
    return "bg-red-50 text-red-800 ring-red-200";
  return "bg-amber-50 text-amber-900 ring-amber-200";
}

function prettyStatus(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3.5">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

export default async function TrialDetailPage({ params }: { params: Promise<{ nctId: string }> }) {
  const { nctId } = await params;
  const trial = await fetchStudyDetail(nctId);
  if (!trial) notFound();

  const ageRange =
    trial.minimumAge || trial.maximumAge
      ? `${trial.minimumAge ?? "Any"} – ${trial.maximumAge ?? "Any"}`
      : "Not specified";

  return (
    <div className="min-h-screen">
      <div className="border-b border-slate-200/80 bg-white/70 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <Link
            href="/search"
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-slate-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to search
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{trial.nctId}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${statusStyle(trial.overallStatus)}`}>
              {prettyStatus(trial.overallStatus)}
            </span>
            {trial.phases.map((p) => (
              <span key={p} className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                {p.replace(/_/g, " ")}
              </span>
            ))}
          </div>
          <h1 className="mt-2 text-2xl font-semibold leading-snug tracking-tight text-slate-900 sm:text-3xl">
            {trial.title}
          </h1>
          {trial.conditions.length > 0 ? (
            <p className="mt-2 text-sm text-slate-600">{trial.conditions.join(" · ")}</p>
          ) : null}
        </div>
      </div>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
        {/* AI panel: plain-language explainer + ask-AI chat */}
        <TrialAiPanel
          nctId={trial.nctId}
          title={trial.title}
          briefSummary={trial.briefSummary ?? ""}
          eligibilityText={trial.eligibilityText ?? ""}
        />

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Study facts</h2>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Fact label="Status" value={prettyStatus(trial.overallStatus)} />
            <Fact label="Phase" value={trial.phases.length ? trial.phases.join(", ").replace(/_/g, " ") : "N/A"} />
            <Fact label="Study type" value={trial.studyType ? prettyStatus(trial.studyType) : "Not specified"} />
            <Fact
              label="Enrollment"
              value={typeof trial.enrollmentCount === "number" ? `${trial.enrollmentCount.toLocaleString()} participants` : "Not specified"}
            />
            <Fact label="Start date" value={trial.startDate ?? "Not specified"} />
            <Fact label="Est. completion" value={trial.completionDate ?? "Not specified"} />
            <Fact label="Lead sponsor" value={trial.leadSponsor ?? "Not specified"} />
            <Fact label="Age range" value={ageRange} />
            <Fact label="Sex" value={trial.sex ? prettyStatus(trial.sex) : "All"} />
          </dl>
        </section>

        {trial.briefSummary ? (
          <section>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Summary</h2>
            <p className="whitespace-pre-wrap rounded-xl border border-slate-200/80 bg-white/80 p-5 text-sm leading-relaxed text-slate-700">
              {trial.briefSummary}
            </p>
          </section>
        ) : null}

        {trial.interventions.length > 0 ? (
          <section>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Interventions</h2>
            <ul className="flex flex-wrap gap-2">
              {trial.interventions.map((iv) => (
                <li key={iv} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700">
                  {iv}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Eligibility criteria</h2>
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">Age: {ageRange}</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
              Sex: {trial.sex ? prettyStatus(trial.sex) : "All"}
            </span>
            {trial.healthyVolunteers ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">{trial.healthyVolunteers}</span>
            ) : null}
          </div>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200/80 bg-slate-50/80 p-5 text-xs leading-relaxed text-slate-800">
            {trial.eligibilityText || "No eligibility text returned."}
          </pre>
        </section>

        {trial.locations.length > 0 ? (
          <section>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">
              Locations <span className="text-sm font-normal text-slate-500">({trial.locations.length})</span>
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {trial.locations.slice(0, 12).map((loc, i) => (
                <li key={i} className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm">
                  <p className="font-medium text-slate-900">{loc.facility || "Study site"}</p>
                  <p className="text-slate-600">
                    {[loc.city, loc.state, loc.country].filter(Boolean).join(", ") || "Location not specified"}
                  </p>
                </li>
              ))}
            </ul>
            {trial.locations.length > 12 ? (
              <p className="mt-2 text-xs text-slate-500">+ {trial.locations.length - 12} more sites on ClinicalTrials.gov</p>
            ) : null}
          </section>
        ) : null}

        {trial.contacts.length > 0 ? (
          <section>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Study contacts</h2>
            <ul className="grid gap-2">
              {trial.contacts.map((c, i) => (
                <li key={i} className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm">
                  <p className="font-medium text-slate-900">
                    {c.name || "Study contact"}
                    {c.role ? <span className="font-normal text-slate-500"> · {prettyStatus(c.role)}</span> : null}
                  </p>
                  <p className="text-slate-600">
                    {[c.phone, c.email].filter(Boolean).join(" · ") || "Contact details on ClinicalTrials.gov"}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="border-t border-slate-100 pt-6">
          <a
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500"
            href={trial.url}
            target="_blank"
            rel="noreferrer"
          >
            View full record on ClinicalTrials.gov
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5h5m0 0v5m0-5L10 14M5 9v10h10" />
            </svg>
          </a>
          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            This page summarizes public ClinicalTrials.gov data and AI-generated explanations. It is not medical advice
            or a determination of eligibility. Always confirm details with the study team.
          </p>
        </div>
      </main>
    </div>
  );
}
