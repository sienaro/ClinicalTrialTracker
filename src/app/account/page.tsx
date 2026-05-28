import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { AccountActions } from "@/components/AccountActions";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { profile: true, _count: { select: { savedTrials: true } } },
  });
  if (!user) redirect("/login");

  const memberSince = new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(user.createdAt);

  return (
    <div className="min-h-screen">
      <div className="border-b border-slate-200/80 bg-white/70 backdrop-blur-md">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Account</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Your account</h1>
        </div>
      </div>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
        <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-900">Profile</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{user.name || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Member since</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{memberSince}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saved trials</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{user._count.savedTrials}</dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
            <Link
              href="/search"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              Edit profile &amp; search
            </Link>
            <Link
              href="/saved"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              View saved trials
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-900">Export your data</h2>
          <p className="mt-1 text-sm text-slate-600">
            Download everything stored for your account. Useful for your records or to share with a clinician.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/api/account/export?format=json"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4" />
              </svg>
              Export all (JSON)
            </a>
            <a
              href="/api/account/export?format=csv"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              Saved trials (CSV)
            </a>
          </div>
        </section>

        <AccountActions />
      </main>
    </div>
  );
}
