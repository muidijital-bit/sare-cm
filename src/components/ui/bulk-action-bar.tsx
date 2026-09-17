"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface BulkAction {
  key: string;
  label: string;
  endpoint: string; // POST endpoint, body: { ids: string[], reason?: string }
  variant?: "danger" | "default";
  /** "{n}" seçili kayıt sayısıyla değiştirilir. */
  confirmMessage: string;
  requireReason?: boolean;
  reasonLabel?: string;
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
    if (!confirm(action.confirmMessage.replace("{n}", String(selected.length)))) return;

    let reason: string | undefined;
    if (action.requireReason) {
      const input = window.prompt(action.reasonLabel ?? "Gerekçe girin:") ?? "";
      if (!input.trim()) return;
      reason = input.trim();
    }

    setBusy(true);
    try {
      const res = await fetch(action.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected, ...(reason ? { reason } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "İşlem başarısız oldu.");
      } else if (Array.isArray(data.failed) && data.failed.length > 0) {
        const succeededCount = Array.isArray(data.succeeded) ? data.succeeded.length : 0;
        alert(
          `${succeededCount} kayıt işlendi, ${data.failed.length} kayıt başarısız oldu:\n` +
            data.failed.map((f: { message: string }) => `- ${f.message}`).join("\n"),
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
