"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { tr } from "@/lib/i18n/tr";

export function DeleteCustomerButton({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm(tr.customer.deleteConfirm)) return;
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/customers/${customerId}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));

    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? tr.common.error);
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
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
