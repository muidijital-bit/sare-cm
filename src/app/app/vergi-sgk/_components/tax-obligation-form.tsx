"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { tr } from "@/lib/i18n/tr";
import type { TaxObligationInput } from "@/lib/validation/tax-obligation";

export function TaxObligationForm() {
  const router = useRouter();
  const [type, setType] = useState<TaxObligationInput["type"]>("KDV");
  const [period, setPeriod] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [isRecurringTemplate, setIsRecurringTemplate] = useState(false);
  const [recurringRule, setRecurringRule] = useState<"MONTHLY" | "QUARTERLY">("MONTHLY");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload: TaxObligationInput = {
      type,
      period,
      dueDate: new Date(dueDate),
      amount: Number(amount),
      note,
      isRecurringTemplate,
      recurringRule: isRecurringTemplate ? recurringRule : undefined,
    };

    const res = await fetch("/api/tax-obligations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }
    router.push("/app/vergi-sgk");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.taxObligation.fields.type}</label>
          <select value={type} onChange={(e) => setType(e.target.value as TaxObligationInput["type"])} className="mt-1 w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-3 py-2 text-sm text-gray-900">
            {Object.entries(tr.taxObligation.type).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.taxObligation.fields.period}</label>
          <input
            required
            placeholder="2026-01"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.taxObligation.fields.dueDate}</label>
          <input
            required
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.taxObligation.fields.amount}</label>
          <input
            required
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">{tr.taxObligation.fields.note}</label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div className="sm:col-span-2 space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={isRecurringTemplate} onChange={(e) => setIsRecurringTemplate(e.target.checked)} />
            {tr.taxObligation.recurring.isTemplate}
          </label>
          {isRecurringTemplate && (
            <select value={recurringRule} onChange={(e) => setRecurringRule(e.target.value as "MONTHLY" | "QUARTERLY")} className="w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-3 py-2 text-sm text-gray-900">
              <option value="MONTHLY">{tr.taxObligation.recurring.monthly}</option>
              <option value="QUARTERLY">{tr.taxObligation.recurring.quarterly}</option>
            </select>
          )}
        </div>
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
