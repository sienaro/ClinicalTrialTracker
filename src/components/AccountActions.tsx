"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export function AccountActions() {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        setError("Could not delete account. Try again.");
        setDeleting(false);
        return;
      }
      await signOut({ callbackUrl: "/" });
    } catch {
      setError("Could not reach the server.");
      setDeleting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-red-200 bg-red-50/50 p-5 sm:p-6">
      <h2 className="text-base font-semibold text-red-900">Danger zone</h2>
      <p className="mt-1 text-sm text-red-800/80">
        Permanently delete your account, profile, and all saved trials. This cannot be undone.
      </p>

      {error ? <p className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}

      {confirming ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-red-900">Are you sure?</span>
          <button
            type="button"
            onClick={() => void deleteAccount()}
            disabled={deleting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-500 disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Yes, delete everything"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={deleting}
            className="text-sm font-medium text-red-700 hover:text-red-900"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50"
        >
          Delete my account
        </button>
      )}
    </section>
  );
}
