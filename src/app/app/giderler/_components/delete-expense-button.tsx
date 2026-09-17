"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmDelete, notifyError } from "@/lib/ui/sweetalert";
import { tr } from "@/lib/i18n/tr";

export function DeleteExpenseButton({ expenseId }: { expenseId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    const ok = await confirmDelete(tr.expense.deleteConfirm);
    if (!ok) return;
    setBusy(true);
    const res = await fetch(`/api/expenses/${expenseId}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      await notifyError(body.error ?? tr.common.error);
      return;
    }
    router.refresh();
  }

  return (
    <button disabled={busy} onClick={handleDelete} className="text-xs text-red-600 hover:underline disabled:opacity-50">
      {tr.expense.delete}
    </button>
  );
}
