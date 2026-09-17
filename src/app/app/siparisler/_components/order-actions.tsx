"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmDelete, notifyError } from "@/lib/ui/sweetalert";
import { tr } from "@/lib/i18n/tr";

interface Props {
  orderId: string;
  status: string;
  canEdit: boolean;
}

export function OrderActions({ orderId, status, canEdit }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function advance() {
    setBusy(true);
    const res = await fetch(`/api/orders/${orderId}/advance`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      await notifyError(body.error ?? tr.common.error);
      return;
    }
    router.refresh();
  }

  async function cancelOrder() {
    const ok = await confirmDelete("Bu siparişi silmek istediğinize emin misiniz?");
    if (!ok) return;
    setBusy(true);
    const res = await fetch(`/api/orders/${orderId}/cancel`, {
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

  if (!canEdit) return null;

  const canAdvance = status !== "COMPLETED" && status !== "CANCELLED";
  const canCancel = status !== "COMPLETED" && status !== "CANCELLED";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canAdvance && (
        <button
          disabled={busy}
          onClick={advance}
          className="rounded-md bg-brand-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {tr.order.actions.advance}
        </button>
      )}
      {canCancel && (
        <button
          disabled={busy}
          onClick={cancelOrder}
          className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {tr.order.actions.cancel}
        </button>
      )}
    </div>
  );
}
