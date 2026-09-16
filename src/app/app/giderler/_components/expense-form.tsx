"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { tr } from "@/lib/i18n/tr";
import type { ExpenseInput } from "@/lib/validation/expense";

export interface ExpenseFormValues {
  categoryId: string;
  spentAt: string;
  amount: string;
  vatAmount: string;
  vendor: string;
  method: string;
  accountId: string;
  note: string;
  isRecurringTemplate: boolean;
}

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_VALUES: ExpenseFormValues = {
  categoryId: "",
  spentAt: today(),
  amount: "",
  vatAmount: "0",
  vendor: "",
  method: "",
  accountId: "",
  note: "",
  isRecurringTemplate: false,
};

interface Props {
  mode: "create" | "edit";
  expenseId?: string;
  initialValues?: Partial<ExpenseFormValues>;
  categories: { id: string; name: string }[];
  accounts: { id: string; name: string }[];
}

export function ExpenseForm({ mode, expenseId, initialValues, categories, accounts }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<ExpenseFormValues>({ ...EMPTY_VALUES, ...initialValues });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload: ExpenseInput = {
      categoryId: values.categoryId,
      spentAt: new Date(values.spentAt),
      amount: Number(values.amount),
      vatAmount: Number(values.vatAmount) || 0,
      vendor: values.vendor,
      method: (values.method || null) as ExpenseInput["method"],
      accountId: values.accountId || null,
      note: values.note,
      isRecurringTemplate: values.isRecurringTemplate,
      recurringRule: values.isRecurringTemplate ? "MONTHLY" : null,
    };

    const url = mode === "create" ? "/api/expenses" : `/api/expenses/${expenseId}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({}));

    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }

    router.push("/app/giderler");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.expense.fields.category}</label>
          <select required value={values.categoryId} onChange={(e) => setValues((v) => ({ ...v, categoryId: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.expense.fields.spentAt}</label>
          <input type="date" required value={values.spentAt} onChange={(e) => setValues((v) => ({ ...v, spentAt: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.expense.fields.amount}</label>
          <input type="number" step="any" required min="0.01" value={values.amount} onChange={(e) => setValues((v) => ({ ...v, amount: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.expense.fields.vatAmount}</label>
          <input type="number" step="any" min="0" value={values.vatAmount} onChange={(e) => setValues((v) => ({ ...v, vatAmount: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.expense.fields.vendor}</label>
          <input value={values.vendor} onChange={(e) => setValues((v) => ({ ...v, vendor: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.expense.fields.method}</label>
          <select value={values.method} onChange={(e) => setValues((v) => ({ ...v, method: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
            <option value="">—</option>
            {Object.entries(tr.payment.method).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.expense.fields.account}</label>
          <select value={values.accountId} onChange={(e) => setValues((v) => ({ ...v, accountId: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
            <option value="">—</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">{tr.expense.fields.note}</label>
          <textarea value={values.note} onChange={(e) => setValues((v) => ({ ...v, note: e.target.value }))} rows={2} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
        </div>

        {mode === "create" && (
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={values.isRecurringTemplate} onChange={(e) => setValues((v) => ({ ...v, isRecurringTemplate: e.target.checked }))} />
              {tr.expense.recurring.isTemplate}
            </label>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {saving ? tr.common.loading : tr.common.save}
        </button>
        <button type="button" onClick={() => router.back()} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          {tr.common.cancel}
        </button>
      </div>
    </form>
  );
}
