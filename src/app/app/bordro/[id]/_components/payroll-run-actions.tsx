"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmAction, confirmDelete, notifyError } from "@/lib/ui/sweetalert";
import { tr } from "@/lib/i18n/tr";

interface Props {
  runId: string;
  accounts: { id: string; name: string }[];
  canEdit: boolean;
}

export function PayrollRunActions({ runId, accounts, canEdit }: Props) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  async function complete() {
    if (!accountId) {
      await notifyError("Önce bir kasa/banka hesabı seçin.");
      return;
    }
    const ok = await confirmAction(tr.payroll.completeConfirm);
    if (!ok) return;
    setBusy(true);
    const res = await fetch(`/api/payroll-runs/${runId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      await notifyError(body.error ?? tr.common.error);
      return;
    }
    router.refresh();
  }

  async function remove() {
    const ok = await confirmDelete(tr.payroll.deleteConfirm);
    if (!ok) return;
    setBusy(true);
    const res = await fetch(`/api/payroll-runs/${runId}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      await notifyError(body.error ?? tr.common.error);
      return;
    }
    router.push("/app/bordro");
    router.refresh();
  }

  if (!canEdit) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-2 py-1.5 text-xs text-gray-900">
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <button disabled={busy} onClick={complete} className="rounded-lg bg-brand-800 shadow-theme-xs px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">
        {tr.payroll.complete}
      </button>
      <button disabled={busy} onClick={remove} className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
        {tr.payroll.delete}
      </button>
    </div>
  );
}
