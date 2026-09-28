"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmAction, confirmDelete, notifyError } from "@/lib/ui/sweetalert";
import { tr } from "@/lib/i18n/tr";

interface Props {
  obligationId: string;
  amount: string;
  accounts: { id: string; name: string }[];
  canEdit: boolean;
  canDelete: boolean;
}

export function TaxObligationActions({ obligationId, amount, accounts, canEdit, canDelete }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function pay() {
    const ok = await confirmAction(`${tr.taxObligation.pay}?`);
    if (!ok) return;
    setBusy(true);
    const res = await fetch(`/api/tax-obligations/${obligationId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paidAmount: Number(amount), paidAt: new Date().toISOString(), accountId: accounts[0]?.id ?? null }),
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
    const ok = await confirmDelete(tr.taxObligation.deleteConfirm);
    if (!ok) return;
    setBusy(true);
    const res = await fetch(`/api/tax-obligations/${obligationId}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      await notifyError(body.error ?? tr.common.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {canEdit && (
        <button disabled={busy} onClick={pay} className="rounded-md bg-brand-800 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {tr.taxObligation.pay}
        </button>
      )}
      {canDelete && (
        <button disabled={busy} onClick={remove} className="text-xs text-red-600 hover:underline disabled:opacity-50">
          {tr.taxObligation.delete}
        </button>
      )}
    </div>
  );
}
