"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmDelete, notifyError } from "@/lib/ui/sweetalert";
import { tr } from "@/lib/i18n/tr";

interface Props {
  endpoint: string;
  /** Varsayılan DELETE. Sipariş/tahsilat gibi "silme yerine iptal" iş kuralına sahip
   *  kayıtlarda arayüz "Sil" olarak gösterilir ama arkada ilgili POST /cancel uç noktasına
   *  sabit bir gerekçeyle (`body`) gidilir — kullanıcıdan gerekçe İSTENMEZ. */
  method?: "DELETE" | "POST";
  body?: Record<string, unknown>;
  confirmMessage: string;
  label?: string;
}

/** Tüm gridlerdeki tek satır "Sil" aksiyonu — ortak SweetAlert2 onayı kullanır. */
export function RowDeleteButton({ endpoint, method = "DELETE", body, confirmMessage, label = tr.common.delete }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    const ok = await confirmDelete(confirmMessage);
    if (!ok) return;
    setBusy(true);
    const res = await fetch(endpoint, {
      method,
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
    const responseBody = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      await notifyError(responseBody.error ?? tr.common.error);
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
