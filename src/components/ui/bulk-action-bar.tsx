"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmDelete, notifyError } from "@/lib/ui/sweetalert";

export interface BulkAction {
  key: string;
  label: string;
  endpoint: string; // POST endpoint, body: { ids: string[], ...extraBody }
  variant?: "danger" | "default";
  /** "{n}" seçili kayıt sayısıyla değiştirilir. */
  confirmMessage: string;
  /** Sabit ek alanlar (örn. sipariş/tahsilat "silme yerine iptal" kuralı için otomatik
   *  gerekçe) — kullanıcıdan İSTENMEZ, isteğe doğrudan eklenir. */
  extraBody?: Record<string, unknown>;
}

interface Props {
  /** Satır onay kutularının class'ı (data-id taşımalı). Örn: "row-select-customers" */
  rowSelector: string;
  /** Başlıktaki "tümünü seç" onay kutusunun class'ı. */
  selectAllSelector: string;
  actions: BulkAction[];
  /** "3 müşteri seçili" gibi — varsayılan "kayıt". */
  entityLabel?: string;
}

/**
 * Sunucu bileşeninin render ettiği satır onay kutularını (düz HTML `<input>`) DOM olay
 * delegasyonuyla dinler — her satırı ayrı bir client component yapmaya gerek kalmaz
 * (bkz. .claude/agents/frontend-ui-dev.md desenleri). Aynı sayfada bu bileşenden yalnızca
 * BİR tane kullanılmalı (global `document` dinleyicisi).
 */
export function BulkActionBar({ rowSelector, selectAllSelector, actions, entityLabel = "kayıt" }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function recompute() {
      const all = Array.from(document.querySelectorAll<HTMLInputElement>(`.${rowSelector}`));
      setSelected(all.filter((el) => el.checked).map((el) => el.dataset.id!).filter(Boolean));
    }
    function onChange(e: Event) {
      const target = e.target as HTMLElement;
      if (target.classList?.contains(selectAllSelector)) {
        const checked = (target as HTMLInputElement).checked;
        document.querySelectorAll<HTMLInputElement>(`.${rowSelector}`).forEach((el) => {
          if (!el.disabled) el.checked = checked;
        });
      }
      recompute();
    }
    document.addEventListener("change", onChange);
    recompute();
    return () => document.removeEventListener("change", onChange);
  }, [rowSelector, selectAllSelector]);

  function resetSelection() {
    document.querySelectorAll<HTMLInputElement>(`.${rowSelector}`).forEach((el) => {
      el.checked = false;
    });
    const selectAll = document.querySelector<HTMLInputElement>(`.${selectAllSelector}`);
    if (selectAll) selectAll.checked = false;
    setSelected([]);
  }

  async function runAction(action: BulkAction) {
    const ok = await confirmDelete(action.confirmMessage.replace("{n}", String(selected.length)));
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(action.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected, ...(action.extraBody ?? {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        await notifyError(data.error ?? "İşlem başarısız oldu.");
      } else if (Array.isArray(data.failed) && data.failed.length > 0) {
        const succeededCount = Array.isArray(data.succeeded) ? data.succeeded.length : 0;
        await notifyError(
          `${succeededCount} kayıt işlendi, ${data.failed.length} kayıt başarısız oldu:\n` +
            data.failed.map((f: { message: string }) => `- ${f.message}`).join("\n"),
          "Kısmi başarı",
        );
      }
      resetSelection();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (selected.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-brand-200 bg-brand-50 px-4 py-2 text-sm">
      <span className="font-medium text-brand-900">
        {selected.length} {entityLabel} seçili
      </span>
      <div className="flex gap-2">
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            disabled={busy}
            onClick={() => runAction(a)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
              a.variant === "danger" ? "bg-red-600 text-white hover:bg-red-500" : "bg-brand-800 text-white hover:bg-brand-700"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
