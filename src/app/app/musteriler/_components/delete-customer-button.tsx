"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmDelete, notifyError } from "@/lib/ui/sweetalert";
import { tr } from "@/lib/i18n/tr";

export function DeleteCustomerButton({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    const ok = await confirmDelete(tr.customer.deleteConfirm);
    if (!ok) return;
    setBusy(true);

    const res = await fetch(`/api/customers/${customerId}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      await notifyError(body.error ?? tr.common.error);
      return;
    }
    router.push("/app/musteriler");
    router.refresh();
  }

  return (
    <div className="text-right">
      <button
        onClick={handleDelete}
        disabled={busy}
        className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {tr.customer.delete}
      </button>
    </div>
  );
}
