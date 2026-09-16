"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { tr } from "@/lib/i18n/tr";

export function DeleteExpenseButton({ expenseId }: { expenseId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm(tr.expense.deleteConfirm)) return;
    setBusy(true);
    const res = await fetch(`/api/expenses/${expenseId}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <button disabled={busy} onClick={handleDelete} className="text-xs text-red-600 hover:underline disabled:opacity-50">
      {tr.expense.delete}
    </button>
  );
}
