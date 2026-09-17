"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { tr } from "@/lib/i18n/tr";

export default function SifreSifirlaPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: params.token, password }),
    });
    const body = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/giris"), 2000);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-950 px-4 py-10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt={tr.common.appName} className="h-16 w-auto" />
      <p className="mb-6 mt-2 text-sm text-white/70">{tr.common.tagline}</p>

      <div className="w-full max-w-sm space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-lg sm:p-8">
        <h1 className="text-center text-lg font-semibold text-gray-900">{tr.passwordReset.confirmTitle}</h1>

        {success ? (
          <p className="text-center text-sm text-green-700">{tr.passwordReset.confirmSuccess}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">{tr.passwordReset.newPassword}</label>
              <input
                type="password"
                required
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {submitting ? tr.common.loading : tr.passwordReset.confirmSubmit}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
