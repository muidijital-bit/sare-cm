"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { tr } from "@/lib/i18n/tr";

export function CancelPaymentButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCancel() {
    const reason = window.prompt(tr.payment.cancelReasonPrompt);
    if (!reason) return;
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/payments/${paymentId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="text-right">
      <button disabled={busy} onClick={handleCancel} className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
        {tr.payment.cancelAction}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
