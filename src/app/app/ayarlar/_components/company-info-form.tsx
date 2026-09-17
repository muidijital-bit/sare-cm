"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { tr } from "@/lib/i18n/tr";
import type { CompanySettingsInput } from "@/lib/validation/company-settings";

export interface CompanyInfoValues {
  name: string;
  taxOffice: string;
  taxNumber: string;
  address: string;
  phone: string;
  defaultVatRate: string;
  quoteValidityDays: string;
  quoteNumberFormat: string;
  orderNumberFormat: string;
}

export function CompanyInfoForm({ initialValues }: { initialValues: CompanyInfoValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);

    const payload: CompanySettingsInput = {
      name: values.name,
      taxOffice: values.taxOffice,
      taxNumber: values.taxNumber,
      address: values.address,
      phone: values.phone,
      defaultVatRate: Number(values.defaultVatRate),
      quoteValidityDays: Number(values.quoteValidityDays),
      quoteNumberFormat: values.quoteNumberFormat,
      orderNumberFormat: values.orderNumberFormat,
    };

    const res = await fetch("/api/company-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-900">{tr.settings.companyInfo}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">{tr.settings.fields.name}</label>
          <input required value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.settings.fields.taxOffice}</label>
          <input value={values.taxOffice} onChange={(e) => setValues((v) => ({ ...v, taxOffice: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.settings.fields.taxNumber}</label>
          <input value={values.taxNumber} onChange={(e) => setValues((v) => ({ ...v, taxNumber: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.settings.fields.phone}</label>
          <input value={values.phone} onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.settings.fields.defaultVatRate}</label>
          <input type="number" step="any" min="0" max="100" value={values.defaultVatRate} onChange={(e) => setValues((v) => ({ ...v, defaultVatRate: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">{tr.settings.fields.address}</label>
          <textarea value={values.address} onChange={(e) => setValues((v) => ({ ...v, address: e.target.value }))} rows={2} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.settings.fields.quoteValidityDays}</label>
          <input type="number" min="1" value={values.quoteValidityDays} onChange={(e) => setValues((v) => ({ ...v, quoteValidityDays: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.settings.fields.quoteNumberFormat}</label>
          <input value={values.quoteNumberFormat} onChange={(e) => setValues((v) => ({ ...v, quoteNumberFormat: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.settings.fields.orderNumberFormat}</label>
          <input value={values.orderNumberFormat} onChange={(e) => setValues((v) => ({ ...v, orderNumberFormat: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-700">{tr.settings.saved}</p>}

      <button type="submit" disabled={saving} className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
        {saving ? tr.common.loading : tr.common.save}
      </button>
    </form>
  );
}
