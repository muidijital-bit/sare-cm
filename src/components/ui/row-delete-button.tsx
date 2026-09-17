"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  endpoint: string; // DELETE isteği atılacak URL
  confirmMessage: string;
  label?: string;
}

/** Tek satır silme — DeleteExpenseButton ile aynı desen, tüm gridlerde ortak kullanım için genelleştirildi. */
export function RowDeleteButton({ endpoint, confirmMessage, label = "Sil" }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm(confirmMessage)) return;
    setBusy(true);
    const res = await fetch(endpoint, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      alert(body.error ?? "İşlem başarısız oldu.");
      return;
    }
    router.refresh();
  }

  return (
    <button disabled={busy} onClick={handleDelete} className="text-xs text-red-600 hover:underline disabled:opacity-50">
      {label}
    </button>
  );
}
