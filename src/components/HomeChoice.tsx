import Link from "next/link";

export function HomeChoice() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-indigo-600">Clinical research</p>
        <h1 className="mt-2 text-center text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Clinical Trial Tracker
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-relaxed text-slate-600 sm:text-base">
          Choose how you want to start. Import runs entirely in your browser; typed search uses the same ranking on{" "}
          <a
            className="font-medium text-indigo-700 underline decoration-indigo-300 underline-offset-2"
            href="https://clinicaltrials.gov/"
          >
            ClinicalTrials.gov
          </a>{" "}
          recruiting listings.
        </p>

        <div className="mt-10 grid gap-6 sm:mt-12">
          <Link
            href="/fhir"
            className="group relative flex flex-col rounded-2xl border-2 border-indigo-300 bg-white p-6 shadow-md ring-2 ring-indigo-100 transition hover:border-indigo-400 hover:shadow-lg sm:p-8"
          >
            <span className="absolute right-4 top-4 rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white sm:text-xs">
              Recommended
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Primary path</span>
            <h2 className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">Import FHIR JSON</h2>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-600">
              Upload or paste a patient bundle (Synthea, EHR export, etc.). We extract conditions and demographics in
              the tab, show you what we found for confirmation, then search recruiting trials.
            </p>
            <span className="mt-6 inline-flex items-center text-sm font-semibold text-indigo-700 group-hover:underline">
              Continue to import
              <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </Link>

          <Link
            href="/search"
            className="group flex flex-col rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm ring-1 ring-slate-900/5 transition hover:border-slate-300 hover:bg-white hover:shadow-md sm:p-7"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Alternative</span>
            <h2 className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl">Search by typing</h2>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-600">
              Enter a condition or topic yourself, optional age and notes, and optional supporting text files for local
              match scoring.
            </p>
            <span className="mt-5 inline-flex items-center text-sm font-semibold text-slate-700 group-hover:underline">
              Open typed search
              <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </Link>
        </div>
      </main>
    </div>
  );
}
