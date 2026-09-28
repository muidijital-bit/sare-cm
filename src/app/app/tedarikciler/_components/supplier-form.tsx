"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { tr } from "@/lib/i18n/tr";
import type { SupplierInput } from "@/lib/validation/supplier";

export interface SupplierFormValues {
  title: string;
  taxOffice: string;
  taxNumber: string;
  address: string;
  phone: string;
  email: string;
  isActive: boolean;
}

const EMPTY_VALUES: SupplierFormValues = { title: "", taxOffice: "", taxNumber: "", address: "", phone: "", email: "", isActive: true };

interface Props {
  mode: "create" | "edit";
  supplierId?: string;
  initialValues?: Partial<SupplierFormValues>;
}

export function SupplierForm({ mode, supplierId, initialValues }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<SupplierFormValues>({ ...EMPTY_VALUES, ...initialValues });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload: SupplierInput = {
      title: values.title,
      taxOffice: values.taxOffice,
      taxNumber: values.taxNumber,
      address: values.address,
      phone: values.phone,
      email: values.email,
      isActive: values.isActive,
    };

    const url = mode === "create" ? "/api/suppliers" : `/api/suppliers/${supplierId}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({}));

    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }

    router.push("/app/tedarikciler");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">{tr.supplier.fields.title}</label>
          <input
            required
            value={values.title}
            onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.supplier.fields.taxOffice}</label>
          <input
            value={values.taxOffice}
            onChange={(e) => setValues((v) => ({ ...v, taxOffice: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.supplier.fields.taxNumber}</label>
          <input
            value={values.taxNumber}
            onChange={(e) => setValues((v) => ({ ...v, taxNumber: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.supplier.fields.phone}</label>
          <input
            value={values.phone}
            onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.supplier.fields.email}</label>
          <input
            type="email"
            value={values.email}
            onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">{tr.supplier.fields.address}</label>
          <textarea
            rows={2}
            value={values.address}
            onChange={(e) => setValues((v) => ({ ...v, address: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
          <input type="checkbox" checked={values.isActive} onChange={(e) => setValues((v) => ({ ...v, isActive: e.target.checked }))} />
          {tr.supplier.fields.isActive}
        </label>
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
