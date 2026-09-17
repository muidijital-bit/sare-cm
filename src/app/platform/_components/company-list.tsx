"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { tr, formatDateTR } from "@/lib/i18n/tr";

interface Company {
  id: string;
  name: string;
  status: string;
  planName: string;
  subscriptionEndsAt: string | null;
  memberCount: number;
  customerCount: number;
}

interface Plan {
  id: string;
  name: string;
}

export function CompanyList({ companies, plans }: { companies: Company[]; plans: Plan[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInviteLink(null);
    setSaving(true);

    const res = await fetch("/api/platform/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ownerEmail, planId, subscriptionEndsAt: subscriptionEndsAt || null }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }

    setInviteLink(`${window.location.origin}/davet/${body.inviteToken}`);
    setName("");
    setOwnerEmail("");
    setSubscriptionEndsAt("");
    router.refresh();
  }

  async function copyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function toggleStatus(companyId: string, currentStatus: string) {
    setBusyId(companyId);
    setError(null);
    const nextStatus = currentStatus === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    const res = await fetch(`/api/platform/companies/${companyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const body = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-brand-800 bg-brand-900/50 p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">{tr.platform.newCompany}</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <input
            required
            placeholder={tr.platform.companyName}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-brand-700 bg-white px-2 py-1.5 text-sm text-gray-900"
          />
          <input
            required
            type="email"
            placeholder={tr.platform.ownerEmail}
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            className="rounded-md border border-brand-700 bg-white px-2 py-1.5 text-sm text-gray-900"
          />
          <select value={planId} onChange={(e) => setPlanId(e.target.value)} className="rounded-md border border-brand-700 bg-white px-2 py-1.5 text-sm text-gray-900">
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={subscriptionEndsAt}
            onChange={(e) => setSubscriptionEndsAt(e.target.value)}
            className="rounded-md border border-brand-700 bg-white px-2 py-1.5 text-sm text-gray-900"
          />
          <button type="submit" disabled={saving || !planId} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-brand-900 hover:bg-brand-50 disabled:opacity-50 sm:col-span-4">
            {saving ? tr.common.loading : tr.platform.newCompany}
          </button>
        </form>

        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}

        {inviteLink && (
          <div className="mt-3 rounded-md border border-amber-400 bg-amber-950/50 p-3 text-sm">
            <p className="mb-1 text-amber-200">{tr.platform.inviteLinkForOwner}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded bg-white px-2 py-1 text-xs text-gray-700">{inviteLink}</code>
              <button type="button" onClick={copyLink} className="whitespace-nowrap rounded-md border border-amber-400 px-2 py-1 text-xs font-medium text-amber-200 hover:bg-amber-900">
                {copied ? tr.users.copied : tr.users.copyLink}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-brand-800">
        <table className="min-w-full divide-y divide-brand-800 text-sm">
          <thead className="bg-brand-900 text-left text-xs font-medium uppercase tracking-wide text-brand-300">
            <tr>
              <th className="px-4 py-3">{tr.platform.companyName}</th>
              <th className="px-4 py-3">{tr.platform.plan}</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">{tr.platform.members}</th>
              <th className="px-4 py-3">{tr.platform.customers}</th>
              <th className="px-4 py-3">{tr.platform.subscriptionEndsAt}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-900">
            {companies.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium text-white">{c.name}</td>
                <td className="px-4 py-3 text-brand-200">{c.planName}</td>
                <td className="px-4 py-3 text-brand-200">{tr.platform.status[c.status as keyof typeof tr.platform.status] ?? c.status}</td>
                <td className="px-4 py-3 text-brand-200">{c.memberCount}</td>
                <td className="px-4 py-3 text-brand-200">{c.customerCount}</td>
                <td className="px-4 py-3 text-brand-200">{c.subscriptionEndsAt ? formatDateTR(new Date(c.subscriptionEndsAt)) : "—"}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => toggleStatus(c.id, c.status)} disabled={busyId === c.id} className="text-xs text-brand-200 hover:text-white disabled:opacity-50">
                    {c.status === "SUSPENDED" ? tr.platform.activate : tr.platform.suspend}
                  </button>
                </td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-brand-400">
                  —
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
