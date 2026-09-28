"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { notifyError, notifySuccess } from "@/lib/ui/sweetalert";
import { tr } from "@/lib/i18n/tr";

export function StockAdjustForm({ productId, unit }: { productId: string; unit: string }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/products/${productId}/stock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: Number(quantity), note }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      await notifyError(body.error ?? tr.common.error);
      return;
    }
    await notifySuccess("Stok güncellendi.");
    setQuantity("");
    setNote("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div>
        <label className="block text-xs font-medium text-gray-700">Miktar ({unit}, + veya -)</label>
        <input
          type="number"
          step="any"
          required
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="örn. -3 veya 10"
          className="mt-1 w-32 rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-3 py-2 text-sm text-gray-900"
        />
      </div>
      <div className="flex-1">
        <label className="block text-xs font-medium text-gray-700">{tr.stock.adjustNote}</label>
        <input required value={note} onChange={(e) => setNote(e.target.value)} placeholder="örn. Sayım farkı" className="mt-1 w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-3 py-2 text-sm text-gray-900" />
      </div>
      <button type="submit" disabled={saving} className="rounded-lg bg-brand-800 shadow-theme-xs px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
        {saving ? tr.common.loading : tr.stock.adjust}
      </button>
    </form>
  );
}
