"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { tr } from "@/lib/i18n/tr";

interface ModuleRow {
  key: string;
  name: string;
  isCore: boolean;
  isFree: boolean;
  inPlan: boolean;
  override: { enabled: boolean; expiresAt: string | null; note: string | null } | null;
  effective: boolean;
}

interface Plan {
  id: string;
  name: string;
}

function badge(m: ModuleRow): { text: string; cls: string } {
  if (m.isCore) return { text: "Çekirdek", cls: "bg-brand-800 text-brand-200" };
  if (m.override?.enabled) return { text: "Ek (pakete ilave)", cls: "bg-emerald-900 text-emerald-200" };
  if (m.override && !m.override.enabled) return { text: "Paketten çıkarıldı", cls: "bg-rose-900 text-rose-200" };
  if (m.isFree) return { text: "Ücretsiz", cls: "bg-sky-900 text-sky-200" };
  if (m.inPlan) return { text: "Pakette", cls: "bg-brand-800 text-brand-200" };
  return { text: "Pakette yok", cls: "bg-brand-950 text-brand-400" };
}

/** Şirketin modüllerini ve paketini yönetir: her modül için aç/kapat (paketin üzerine ekle/çıkar). */
export function CompanyModulesPanel({ companyId, planName, plans }: { companyId: string; planName: string; plans: Plan[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<ModuleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [planId, setPlanId] = useState(plans.find((p) => p.name === planName)?.id ?? "");
  const [planBusy, setPlanBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/platform/companies/${companyId}/modules`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }
    setRows(body);
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(m: ModuleRow) {
    setBusyKey(m.key);
    setError(null);
    // Hedef: fiilen açıksa kapat, kapalıysa aç. Paketle uyumluysa override'ı sil, değilse override yaz.
    const wantEnabled = !m.effective;
    const enabled: boolean | null = wantEnabled === (m.isFree || m.inPlan) ? null : wantEnabled;
    const res = await fetch(`/api/platform/companies/${companyId}/modules`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleKey: m.key, enabled }),
    });
    const body = await res.json().catch(() => ({}));
    setBusyKey(null);
    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }
    await load();
    router.refresh();
  }

  async function changePlan() {
    setPlanBusy(true);
    setError(null);
    const res = await fetch(`/api/platform/companies/${companyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    const body = await res.json().catch(() => ({}));
    setPlanBusy(false);
    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }
    await load();
    router.refresh();
  }

  return (
    <div className="space-y-3 bg-brand-950/60 p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-brand-300">Paket:</span>
        <select value={planId} onChange={(e) => setPlanId(e.target.value)} className="rounded-md border border-brand-700 bg-white px-2 py-1 text-sm text-gray-900">
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button onClick={changePlan} disabled={planBusy || plans.find((p) => p.id === planId)?.name === planName} className="rounded-md bg-white px-3 py-1 text-xs font-medium text-brand-900 hover:bg-brand-50 disabled:opacity-40">
          {planBusy ? tr.common.loading : "Paketi değiştir"}
        </button>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      {!rows ? (
        <p className="text-sm text-brand-300">{tr.common.loading}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((m) => {
            const b = badge(m);
            return (
              <li key={m.key} className="flex items-center justify-between gap-3 rounded-md border border-brand-800 bg-brand-900/60 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{m.name}</p>
                  <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${b.cls}`}>{b.text}</span>
                </div>
                <button
                  role="switch"
                  aria-checked={m.effective}
                  aria-label={`${m.name} ${m.effective ? "kapat" : "aç"}`}
                  disabled={m.isCore || busyKey === m.key}
                  onClick={() => toggle(m)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${m.effective ? "bg-emerald-500" : "bg-brand-700"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${m.effective ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
