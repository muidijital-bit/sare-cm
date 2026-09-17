"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { tr } from "@/lib/i18n/tr";

const ROLES = ["ADMIN", "SALES", "ACCOUNTING", "VIEWER"] as const; // OWNER daveti UI'dan yapılmaz

export function InviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("SALES");
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInviteLink(null);
    setSaving(true);

    const res = await fetch("/api/users/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role }) });
    const body = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }

    setInviteLink(`${window.location.origin}/davet/${body.token}`);
    setEmail("");
    router.refresh();
  }

  async function copyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">{tr.users.inviteNew}</h2>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <input
          type="email"
          required
          placeholder={tr.users.email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-w-[220px] flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
        />
        <select value={role} onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {tr.users.roleLabels[r]}
            </option>
          ))}
        </select>
        <button type="submit" disabled={saving} className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {saving ? tr.common.loading : tr.users.inviteNew}
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {inviteLink && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="mb-1 text-amber-800">{tr.users.inviteLink}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded bg-white px-2 py-1 text-xs text-gray-700">{inviteLink}</code>
            <button type="button" onClick={copyLink} className="whitespace-nowrap rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100">
              {copied ? tr.users.copied : tr.users.copyLink}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
