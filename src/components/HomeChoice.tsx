import Link from "next/link";

const STEPS = [
  { n: "1", title: "Bring your data", body: "Import a FHIR bundle or just type a condition." },
  { n: "2", title: "We pull live trials", body: "Recruiting studies straight from ClinicalTrials.gov." },
  { n: "3", title: "Gemini ranks the fit", body: "AI reads each trial's eligibility and explains the match." },
];

export function HomeChoice() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="animate-fade-in-up flex flex-col items-center text-center">
          <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h4l2-6 4 12 2-6h6" />
            </svg>
          </span>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-indigo-600 ring-1 ring-indigo-200 backdrop-blur">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            AI-powered matching
          </p>
          <h1 className="mt-4 bg-gradient-to-br from-slate-900 via-indigo-900 to-violet-800 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
            Find the clinical trials
            <br />
            that actually fit you
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Google Gemini reads the full eligibility criteria of recruiting studies on{" "}
            <a
              className="font-medium text-indigo-700 underline decoration-indigo-300 underline-offset-2"
              href="https://clinicaltrials.gov/"
            >
              ClinicalTrials.gov
            </a>{" "}
            and ranks them against your profile — with a plain-English reason for every match. Everything runs in your
            browser tab.
          </p>
        </div>

        <div className="animate-fade-in-up mt-10 grid gap-6 sm:mt-12" style={{ animationDelay: "80ms" }}>
          <Link
            href="/fhir"
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-indigo-200 bg-white/90 p-6 shadow-md ring-1 ring-indigo-100 backdrop-blur transition hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-500/10 sm:p-8"
          >
            <span className="absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 rounded-full bg-gradient-to-br from-indigo-400/20 to-violet-400/20 blur-2xl transition group-hover:scale-150" />
            <span className="absolute right-4 top-4 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white sm:text-xs">
              Recommended
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Primary path</span>
            <h2 className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">Import FHIR JSON</h2>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-600">
              Upload or paste a patient bundle (Synthea, EHR export, etc.). We extract conditions and demographics in
              the tab, show you what we found for confirmation, then let Gemini rank recruiting trials.
            </p>
            <span className="mt-6 inline-flex items-center text-sm font-semibold text-indigo-700 group-hover:underline">
              Continue to import
              <svg className="ml-1 h-4 w-4 transition group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </Link>

          <Link
            href="/search"
            className="group flex flex-col rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm ring-1 ring-slate-900/5 backdrop-blur transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-md sm:p-7"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Alternative</span>
            <h2 className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl">Search by typing</h2>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-600">
              Enter a condition or topic yourself, optional age and notes, and optional supporting text files for AI
              match scoring.
            </p>
            <span className="mt-5 inline-flex items-center text-sm font-semibold text-slate-700 group-hover:underline">
              Open typed search
              <svg className="ml-1 h-4 w-4 transition group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </Link>
        </div>

        <div className="animate-fade-in-up mt-12 grid gap-4 sm:grid-cols-3" style={{ animationDelay: "160ms" }}>
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-xl border border-slate-200/70 bg-white/60 p-4 backdrop-blur">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                {s.n}
              </span>
              <p className="mt-2.5 text-sm font-semibold text-slate-900">{s.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{s.body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
