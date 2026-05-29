"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

const link =
  "rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900";
const linkActive = "bg-rose-50 text-rose-900 ring-1 ring-rose-100";

type SiteNavProps = {
  pathname: string;
};

export function SiteNav({ pathname }: SiteNavProps) {
  const { data: session, status } = useSession();
  const isHome = pathname === "/";
  const isFhir = pathname === "/fhir" || pathname.startsWith("/fhir/");
  const isSearch = pathname === "/search" || pathname.startsWith("/search/");
  const isSaved = pathname === "/saved" || pathname.startsWith("/saved/");
  const isAccount = pathname === "/account" || pathname.startsWith("/account/");
  const loggedIn = status === "authenticated";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-amber-600 shadow-sm shadow-rose-500/30">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h4l2-6 4 12 2-6h6" />
            </svg>
          </span>
          <span className="bg-gradient-to-r from-rose-700 to-amber-700 bg-clip-text text-sm font-bold text-transparent">
            Clinical Trial Tracker
          </span>
          <span className="hidden items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700 ring-1 ring-rose-200 sm:inline-flex">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            AI
          </span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
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
            {loggedIn ? (
              <Link href="/saved" className={`${link} ${isSaved ? linkActive : ""}`}>
                Saved
              </Link>
            ) : null}
          </nav>

          <div className="flex items-center gap-2 border-l border-slate-200 pl-2">
            {loggedIn ? (
              <>
                <Link
                  href="/account"
                  className={`hidden max-w-[160px] truncate rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 sm:inline-block ${isAccount ? "bg-rose-50 text-rose-900 ring-1 ring-rose-100" : ""}`}
                >
                  {session?.user?.email}
                </Link>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className={link}>
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
