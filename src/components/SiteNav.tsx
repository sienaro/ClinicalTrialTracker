import Link from "next/link";

const link =
  "rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900";
const linkActive = "bg-indigo-50 text-indigo-900 ring-1 ring-indigo-100";

type SiteNavProps = {
  pathname: string;
};

export function SiteNav({ pathname }: SiteNavProps) {
  const isHome = pathname === "/";
  const isFhir = pathname === "/fhir" || pathname.startsWith("/fhir/");
  const isSearch = pathname === "/search" || pathname.startsWith("/search/");

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm shadow-indigo-500/30">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h4l2-6 4 12 2-6h6" />
            </svg>
          </span>
          <span className="bg-gradient-to-r from-indigo-700 to-violet-700 bg-clip-text text-sm font-bold text-transparent">
            Clinical Trial Tracker
          </span>
          <span className="hidden items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 ring-1 ring-indigo-200 sm:inline-flex">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            AI
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1" aria-label="Primary">
          <Link href="/" className={`${link} ${isHome ? linkActive : ""}`}>
            Start
          </Link>
          <Link href="/fhir" className={`${link} ${isFhir ? linkActive : ""}`}>
            Import
          </Link>
          <Link href="/search" className={`${link} ${isSearch ? linkActive : ""}`}>
            Search
          </Link>
        </nav>
      </div>
    </header>
  );
}
