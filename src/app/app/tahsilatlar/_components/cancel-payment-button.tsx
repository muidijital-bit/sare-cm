"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmDelete, notifyError } from "@/lib/ui/sweetalert";
import { tr } from "@/lib/i18n/tr";

export function CancelPaymentButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleCancel() {
    const ok = await confirmDelete("Bu tahsilatı silmek istediğinize emin misiniz?");
    if (!ok) return;
    setBusy(true);

    const res = await fetch(`/api/payments/${paymentId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: tr.common.autoDeleteReason }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      await notifyError(body.error ?? tr.common.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="text-right">
      <button disabled={busy} onClick={handleCancel} className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
        {tr.payment.cancelAction}
      </button>
    </div>
  );
}
