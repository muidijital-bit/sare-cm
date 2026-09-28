"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { tr, formatCurrencyTRY } from "@/lib/i18n/tr";
import { notifyError } from "@/lib/ui/sweetalert";

export interface PayrollItemRow {
  id: string;
  employeeId: string;
  employeeName: string;
  grossSalary: string;
  employeeSgkCut: string;
  unemploymentCut: string;
  incomeTax: string;
  stampTax: string;
  employerSgkCost: string;
  netSalary: string;
}

function netOf(row: { grossSalary: string; employeeSgkCut: string; unemploymentCut: string; incomeTax: string; stampTax: string }): number {
  return Number(row.grossSalary) - Number(row.employeeSgkCut) - Number(row.unemploymentCut) - Number(row.incomeTax) - Number(row.stampTax);
}

function ItemRow({ runId, row, editable }: { runId: string; row: PayrollItemRow; editable: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState(row);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  function update(field: keyof PayrollItemRow, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/payroll-runs/${runId}/items/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: values.employeeId,
        grossSalary: Number(values.grossSalary),
        employeeSgkCut: Number(values.employeeSgkCut),
        unemploymentCut: Number(values.unemploymentCut),
        incomeTax: Number(values.incomeTax),
        stampTax: Number(values.stampTax),
        employerSgkCost: Number(values.employerSgkCost),
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      await notifyError(body.error ?? tr.common.error);
      return;
    }
    setDirty(false);
    router.refresh();
  }

  const inputClass = "w-24 rounded-md border border-gray-300 bg-white px-2 py-1 text-right text-sm text-gray-900";

  if (!editable) {
    return (
      <tr>
        <td className="px-4 py-3 text-gray-900">{row.employeeName}</td>
        <td className="px-4 py-3 text-right text-gray-600">{formatCurrencyTRY(Number(row.grossSalary))}</td>
        <td className="px-4 py-3 text-right text-gray-600">{formatCurrencyTRY(Number(row.employeeSgkCut))}</td>
        <td className="px-4 py-3 text-right text-gray-600">{formatCurrencyTRY(Number(row.unemploymentCut))}</td>
        <td className="px-4 py-3 text-right text-gray-600">{formatCurrencyTRY(Number(row.incomeTax))}</td>
        <td className="px-4 py-3 text-right text-gray-600">{formatCurrencyTRY(Number(row.stampTax))}</td>
        <td className="px-4 py-3 text-right text-gray-600">{formatCurrencyTRY(Number(row.employerSgkCost))}</td>
        <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrencyTRY(Number(row.netSalary))}</td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="px-4 py-3 text-gray-900">{row.employeeName}</td>
      <td className="px-4 py-3 text-right"><input type="number" step="0.01" value={values.grossSalary} onChange={(e) => update("grossSalary", e.target.value)} className={inputClass} /></td>
      <td className="px-4 py-3 text-right"><input type="number" step="0.01" value={values.employeeSgkCut} onChange={(e) => update("employeeSgkCut", e.target.value)} className={inputClass} /></td>
      <td className="px-4 py-3 text-right"><input type="number" step="0.01" value={values.unemploymentCut} onChange={(e) => update("unemploymentCut", e.target.value)} className={inputClass} /></td>
      <td className="px-4 py-3 text-right"><input type="number" step="0.01" value={values.incomeTax} onChange={(e) => update("incomeTax", e.target.value)} className={inputClass} /></td>
      <td className="px-4 py-3 text-right"><input type="number" step="0.01" value={values.stampTax} onChange={(e) => update("stampTax", e.target.value)} className={inputClass} /></td>
      <td className="px-4 py-3 text-right"><input type="number" step="0.01" value={values.employerSgkCost} onChange={(e) => update("employerSgkCost", e.target.value)} className={inputClass} /></td>
      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrencyTRY(netOf(values))}</td>
      <td className="px-4 py-3 text-right">
        {dirty && (
          <button disabled={saving} onClick={save} className="rounded-md bg-brand-800 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {saving ? "…" : tr.common.save}
          </button>
        )}
      </td>
    </tr>
  );
}

export function PayrollItemsTable({ runId, items, editable }: { runId: string; items: PayrollItemRow[]; editable: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3">{tr.payroll.fields.item.employee}</th>
            <th className="px-4 py-3 text-right">{tr.payroll.fields.item.grossSalary}</th>
            <th className="px-4 py-3 text-right">{tr.payroll.fields.item.employeeSgkCut}</th>
            <th className="px-4 py-3 text-right">{tr.payroll.fields.item.unemploymentCut}</th>
            <th className="px-4 py-3 text-right">{tr.payroll.fields.item.incomeTax}</th>
            <th className="px-4 py-3 text-right">{tr.payroll.fields.item.stampTax}</th>
            <th className="px-4 py-3 text-right">{tr.payroll.fields.item.employerSgkCost}</th>
            <th className="px-4 py-3 text-right">{tr.payroll.fields.item.netSalary}</th>
            {editable && <th className="px-4 py-3"></th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.length === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                Aktif personel yok — önce Personel modülünden çalışan ekleyin.
              </td>
            </tr>
          )}
          {items.map((row) => (
            <ItemRow key={row.id} runId={runId} row={row} editable={editable} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
