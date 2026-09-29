"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { tr } from "@/lib/i18n/tr";
import type { ProductInput } from "@/lib/validation/product";

export interface ProductFormValues {
  code: string;
  name: string;
  unit: string;
  listPrice: string;
  defaultCost: string;
  vatRate: string;
  defaultSupplierId: string;
  isActive: boolean;
}

const EMPTY_VALUES: ProductFormValues = { code: "", name: "", unit: "adet", listPrice: "0", defaultCost: "", vatRate: "20", defaultSupplierId: "", isActive: true };

interface Props {
  mode: "create" | "edit";
  productId?: string;
  initialValues?: Partial<ProductFormValues>;
  suppliers?: { id: string; title: string }[];
  /** Tedarikçi modülü açık ve görme yetkisi var mı — yoksa alan hiç gösterilmez. */
  supplierAccess?: boolean;
}

export function ProductForm({ mode, productId, initialValues, suppliers = [], supplierAccess = false }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<ProductFormValues>({ ...EMPTY_VALUES, ...initialValues });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload: ProductInput = {
      code: values.code,
      name: values.name,
      unit: values.unit,
      listPrice: Number(values.listPrice),
      defaultCost: values.defaultCost === "" ? null : Number(values.defaultCost),
      vatRate: Number(values.vatRate),
      defaultSupplierId: values.defaultSupplierId || null,
      isActive: values.isActive,
    };

    const url = mode === "create" ? "/api/products" : `/api/products/${productId}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({}));

    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }

    router.push("/app/urunler");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">{tr.product.fields.name}</label>
          <input
            required
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.product.fields.code}</label>
          <input
            value={values.code}
            onChange={(e) => setValues((v) => ({ ...v, code: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.product.fields.unit}</label>
          <input
            required
            value={values.unit}
            onChange={(e) => setValues((v) => ({ ...v, unit: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.product.fields.listPrice}</label>
          <input
            required
            type="number"
            step="0.01"
            min="0"
            value={values.listPrice}
            onChange={(e) => setValues((v) => ({ ...v, listPrice: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.product.fields.defaultCost}</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={values.defaultCost}
            onChange={(e) => setValues((v) => ({ ...v, defaultCost: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.product.fields.vatRate}</label>
          <input
            required
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={values.vatRate}
            onChange={(e) => setValues((v) => ({ ...v, vatRate: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-3 py-2 text-sm text-gray-900"
          />
        </div>

        {supplierAccess && suppliers.length === 0 && (
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">{tr.product.fields.defaultSupplier}</label>
            <p className="mt-1 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500">
              Henüz tedarikçi yok.{" "}
              <a href="/app/tedarikciler/yeni" className="font-medium text-brand-700 hover:underline">
                Tedarikçi ekleyin
              </a>{" "}
              — sonra buradan seçebilirsiniz.
            </p>
          </div>
        )}

        {suppliers.length > 0 && (
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">{tr.product.fields.defaultSupplier}</label>
            <select
              value={values.defaultSupplierId}
              onChange={(e) => setValues((v) => ({ ...v, defaultSupplierId: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-3 py-2 text-sm text-gray-900"
            >
              <option value="">—</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">{tr.product.fields.defaultSupplierHint}</p>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
          <input type="checkbox" checked={values.isActive} onChange={(e) => setValues((v) => ({ ...v, isActive: e.target.checked }))} />
          {tr.product.fields.isActive}
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
