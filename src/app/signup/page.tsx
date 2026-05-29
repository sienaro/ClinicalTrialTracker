"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Could not create account.";
        setError(msg);
        return;
      }
      // Auto-login after successful signup.
      const login = await signIn("credentials", { email, password, redirect: false });
      if (login?.error) {
        router.push("/login");
        return;
      }
      router.push("/search");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto flex max-w-md flex-col px-4 py-16 sm:px-6">
        <div className="animate-fade-in-up rounded-2xl border border-slate-200/80 bg-white/90 p-7 shadow-sm ring-1 ring-slate-900/5 backdrop-blur sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Create your account</h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Save trials, track applications, and keep your profile in one place.
          </p>

          <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-slate-800">Name (optional)</span>
              <input
                type="text"
                autoComplete="name"
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-slate-800">Email</span>
              <input
                type="email"
                autoComplete="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-slate-800">Password</span>
              <input
                type="password"
                autoComplete="new-password"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
              <span className="text-xs text-slate-500">At least 8 characters.</span>
            </label>

            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="mt-5 text-sm text-slate-600">
            Already have an account?{" "}
            <Link className="font-semibold text-rose-700 underline decoration-rose-200 underline-offset-2" href="/login">
              Log in
            </Link>
          </p>

          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
            Your profile and saved trials are stored in this app&apos;s local database. Avoid entering highly sensitive
            personal health information.
          </p>
        </div>
      </main>
    </div>
  );
}
