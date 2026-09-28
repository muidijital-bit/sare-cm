"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { tr, formatCurrencyTRY } from "@/lib/i18n/tr";
import type { PurchaseOrderInput } from "@/lib/validation/purchase-order";

export interface PurchaseItemRow {
  productId: string;
  description: string;
  quantity: string;
  unitCost: string;
  vatRate: string;
}

function emptyItem(): PurchaseItemRow {
  return { productId: "", description: "", quantity: "1", unitCost: "0", vatRate: "20" };
}

export interface PurchaseOrderFormValues {
  supplierId: string;
  orderedAt: string;
  note: string;
  items: PurchaseItemRow[];
}

const today = () => new Date().toISOString().slice(0, 10);

interface ProductOption {
  id: string;
  name: string;
  defaultCost: number | null;
  vatRate: number;
}

interface Props {
  suppliers: { id: string; title: string }[];
  products: ProductOption[];
}

/** Tekliften/siparişten daha basit: iskonto yok, yalnızca miktar × birim maliyet + KDV
 *  (bkz. src/lib/modules/purchase-orders/service.ts calculateItems). Bu yüzden shared
 *  `LineItemEditor` yerine kendi (daha sade) satır editörü kullanılır. */
export function PurchaseOrderForm({ suppliers, products }: Props) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState("");
  const [orderedAt, setOrderedAt] = useState(today());
  const [note, setNote] = useState("");
  const [items, setItems] = useState<PurchaseItemRow[]>([emptyItem()]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateItem(i: number, patch: Partial<PurchaseItemRow>) {
    setItems((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addItem() {
    setItems((rows) => [...rows, emptyItem()]);
  }
  function removeItem(i: number) {
    setItems((rows) => (rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows));
  }
  function pickProduct(i: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    updateItem(i, {
      productId,
      description: p ? p.name : "",
      unitCost: p?.defaultCost != null ? String(p.defaultCost) : "0",
      vatRate: p ? String(p.vatRate) : "20",
    });
  }

  const total = items.reduce((sum, it) => {
    const line = (Number(it.quantity) || 0) * (Number(it.unitCost) || 0);
    return sum + line + (line * (Number(it.vatRate) || 0)) / 100;
  }, 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supplierId) {
      setError("Tedarikçi seçin.");
      return;
    }
    setSaving(true);

    const payload: PurchaseOrderInput = {
      supplierId,
      orderedAt: new Date(orderedAt),
      note,
      items: items.map((it) => ({
        productId: it.productId || null,
        description: it.description,
        quantity: Number(it.quantity),
        unitCost: Number(it.unitCost),
        vatRate: Number(it.vatRate),
      })),
    };

    const res = await fetch("/api/purchase-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }
    router.push(`/app/satin-almalar/${body.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.purchaseOrder.fields.supplier}</label>
          <select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-3 py-2 text-sm text-gray-900">
            <option value="">—</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.purchaseOrder.fields.orderedAt}</label>
          <input type="date" required value={orderedAt} onChange={(e) => setOrderedAt(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-3 py-2 text-sm text-gray-900" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">{tr.purchaseOrder.fields.note}</label>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-3 py-2 text-sm text-gray-900" />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-theme-xs font-medium text-gray-500">
            <tr>
              <th className="px-3 py-2">{tr.purchaseOrder.fields.item.product}</th>
              <th className="px-3 py-2">{tr.purchaseOrder.fields.item.description}</th>
              <th className="w-24 px-3 py-2">{tr.purchaseOrder.fields.item.quantity}</th>
              <th className="w-32 px-3 py-2">{tr.purchaseOrder.fields.item.unitCost}</th>
              <th className="w-20 px-3 py-2">{tr.purchaseOrder.fields.item.vatRate}</th>
              <th className="w-8 px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((it, i) => (
              <tr key={i}>
                <td className="px-3 py-2">
                  <select value={it.productId} onChange={(e) => pickProduct(i, e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-2 py-1.5 text-sm text-gray-900">
                    <option value="">—</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input required value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} className="w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-2 py-1.5 text-sm text-gray-900" />
                </td>
                <td className="px-3 py-2">
                  <input type="number" step="any" min="0.0001" required value={it.quantity} onChange={(e) => updateItem(i, { quantity: e.target.value })} className="w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-2 py-1.5 text-sm text-gray-900" />
                </td>
                <td className="px-3 py-2">
                  <input type="number" step="any" min="0" required value={it.unitCost} onChange={(e) => updateItem(i, { unitCost: e.target.value })} className="w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-2 py-1.5 text-sm text-gray-900" />
                </td>
                <td className="px-3 py-2">
                  <input type="number" step="any" min="0" max="100" required value={it.vatRate} onChange={(e) => updateItem(i, { vatRate: e.target.value })} className="w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-2 py-1.5 text-sm text-gray-900" />
                </td>
                <td className="px-3 py-2 text-right">
                  <button type="button" onClick={() => removeItem(i)} className="text-xs text-red-600 hover:underline">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={addItem} className="text-sm font-medium text-brand-700 hover:underline">
          + Satır Ekle
        </button>
        <p className="text-sm font-semibold text-gray-900">Toplam: {formatCurrencyTRY(total)}</p>
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
