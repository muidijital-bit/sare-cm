"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { tr } from "@/lib/i18n/tr";

interface InvitationInfo {
  email: string;
  role: string;
  companyName: string;
  valid: boolean;
}

export default function DavetKabulPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/invitations/${params.token}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setInfo)
      .finally(() => setLoading(false));
  }, [params.token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: params.token, name, password }),
    });
    const body = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }

    router.push("/giris");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-950 px-4 py-10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt={tr.common.appName} className="h-16 w-auto" />
      <p className="mb-6 mt-2 text-sm text-white/70">{tr.common.tagline}</p>

      <div className="w-full max-w-sm space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-lg sm:p-8">
        <h1 className="text-center text-lg font-semibold text-gray-900">{tr.users.acceptTitle}</h1>

        {loading ? (
          <p className="text-center text-sm text-gray-500">{tr.common.loading}</p>
        ) : !info || !info.valid ? (
          <p className="text-center text-sm text-red-600">{tr.users.invalidToken}</p>
        ) : (
          <>
            <p className="text-center text-sm text-gray-600">
              <span className="font-medium text-gray-900">{info.companyName}</span> ·{" "}
              {tr.users.roleLabels[info.role as keyof typeof tr.users.roleLabels]}
              <br />
              <span className="text-xs text-gray-400">{info.email}</span>
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{tr.users.acceptName}</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{tr.users.acceptPassword}</label>
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
                {submitting ? tr.common.loading : tr.users.acceptSubmit}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
