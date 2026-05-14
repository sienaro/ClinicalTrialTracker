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
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="text-sm font-semibold text-slate-900">
          Clinical Trial Tracker
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
