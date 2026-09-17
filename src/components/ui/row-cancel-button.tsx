"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  endpoint: string; // POST isteği atılacak URL, body: { reason }
  reasonPrompt: string;
  label?: string;
}

/** Tek satır iptal — sipariş/tahsilat gibi "silme yerine iptal" kuralına sahip kayıtlar için. */
export function RowCancelButton({ endpoint, reasonPrompt, label = "İptal Et" }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleCancel() {
    const reason = window.prompt(reasonPrompt);
    if (!reason || !reason.trim()) return;
    setBusy(true);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      alert(body.error ?? "İşlem başarısız oldu.");
      return;
    }
    router.refresh();
  }

  return (
    <button disabled={busy} onClick={handleCancel} className="text-xs text-red-600 hover:underline disabled:opacity-50">
      {label}
    </button>
  );
}
