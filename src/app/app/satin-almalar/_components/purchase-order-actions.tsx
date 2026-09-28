"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmAction, confirmDelete, notifyError } from "@/lib/ui/sweetalert";
import { tr } from "@/lib/i18n/tr";

interface Props {
  purchaseOrderId: string;
  status: string;
  canEdit: boolean;
}

export function PurchaseOrderActions({ purchaseOrderId, status, canEdit }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function receive() {
    const ok = await confirmAction(tr.purchaseOrder.receiveConfirm);
    if (!ok) return;
    setBusy(true);
    const res = await fetch(`/api/purchase-orders/${purchaseOrderId}/receive`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      await notifyError(body.error ?? tr.common.error);
      return;
    }
    router.refresh();
  }

  async function cancel() {
    const ok = await confirmDelete(tr.purchaseOrder.cancelConfirm);
    if (!ok) return;
    setBusy(true);
    const res = await fetch(`/api/purchase-orders/${purchaseOrderId}/cancel`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      await notifyError(body.error ?? tr.common.error);
      return;
    }
    router.refresh();
  }

  if (!canEdit || status === "CANCELLED") return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "DRAFT" && (
        <button disabled={busy} onClick={receive} className="rounded-lg bg-brand-800 shadow-theme-xs px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {tr.purchaseOrder.receive}
        </button>
      )}
      <button disabled={busy} onClick={cancel} className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
        {tr.purchaseOrder.cancel}
      </button>
    </div>
  );
}
