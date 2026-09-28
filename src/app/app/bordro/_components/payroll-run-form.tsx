"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { tr } from "@/lib/i18n/tr";
import type { PayrollRunInput } from "@/lib/validation/payroll";

export function PayrollRunForm() {
  const router = useRouter();
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [period, setPeriod] = useState(defaultPeriod);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload: PayrollRunInput = { period, note };
    const res = await fetch("/api/payroll-runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }
    router.push(`/app/bordro/${body.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">{tr.payroll.disclaimer}</p>

      <div>
        <label className="block text-sm font-medium text-gray-700">{tr.payroll.fields.period}</label>
        <input
          required
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-3 py-2 text-sm text-gray-900"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">{tr.payroll.fields.note}</label>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-3 py-2 text-sm text-gray-900"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="rounded-lg bg-brand-800 shadow-theme-xs px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {saving ? tr.common.loading : tr.common.save}
        </button>
        <button type="button" onClick={() => router.back()} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          {tr.common.cancel}
        </button>
      </div>
    </form>
  );
}
