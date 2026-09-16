"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { tr } from "@/lib/i18n/tr";
import { LineItemEditor, emptyLineItem, type LineItemRow, type ProductOption } from "@/components/documents/line-item-editor";
import type { OrderInput } from "@/lib/validation/order";

export interface PaymentScheduleRow {
  dueDate: string;
  amount: string;
  description: string;
}

export interface OrderFormValues {
  customerId: string;
  orderDate: string;
  dueDate: string;
  deliveryAddress: string;
  ownerUserId: string;
  note: string;
  documentDiscountType: "PERCENT" | "AMOUNT";
  documentDiscountValue: string;
  items: LineItemRow[];
  paymentSchedules: PaymentScheduleRow[];
}

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_VALUES: OrderFormValues = {
  customerId: "",
  orderDate: today(),
  dueDate: "",
  deliveryAddress: "",
  ownerUserId: "",
  note: "",
  documentDiscountType: "PERCENT",
  documentDiscountValue: "0",
  items: [emptyLineItem()],
  paymentSchedules: [],
};

interface Props {
  mode: "create" | "edit";
  orderId?: string;
  quoteId?: string;
  initialValues?: Partial<OrderFormValues>;
  customers: { id: string; title: string }[];
  products: ProductOption[];
  users: { id: string; name: string }[];
  canAssignOwner: boolean;
}

export function OrderForm({ mode, orderId, quoteId, initialValues, customers, products, users, canAssignOwner }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<OrderFormValues>({ ...EMPTY_VALUES, ...initialValues });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function addSchedule() {
    setValues((v) => ({ ...v, paymentSchedules: [...v.paymentSchedules, { dueDate: today(), amount: "0", description: "" }] }));
  }
  function updateSchedule(i: number, patch: Partial<PaymentScheduleRow>) {
    setValues((v) => ({ ...v, paymentSchedules: v.paymentSchedules.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) }));
  }
  function removeSchedule(i: number) {
    setValues((v) => ({ ...v, paymentSchedules: v.paymentSchedules.filter((_, idx) => idx !== i) }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!values.customerId) {
      setError("Müşteri seçin.");
      return;
    }
    setSaving(true);

    const payload: OrderInput = {
      customerId: values.customerId,
      quoteId: quoteId || null,
      orderDate: new Date(values.orderDate),
      dueDate: values.dueDate ? new Date(values.dueDate) : null,
      deliveryAddress: values.deliveryAddress,
      ownerUserId: values.ownerUserId || null,
      note: values.note,
      documentDiscount:
        Number(values.documentDiscountValue) > 0 ? { type: values.documentDiscountType, value: Number(values.documentDiscountValue) } : null,
      items: values.items.map((it) => ({
        id: it.id,
        productId: it.productId || null,
        description: it.description,
        quantity: Number(it.quantity),
        unit: it.unit,
        unitPrice: Number(it.unitPrice),
        unitCost: it.unitCost ? Number(it.unitCost) : null,
        discountType: it.discountType,
        discountValue: Number(it.discountValue),
        vatRate: Number(it.vatRate),
      })),
      paymentSchedules: values.paymentSchedules
        .filter((s) => Number(s.amount) > 0)
        .map((s) => ({ dueDate: new Date(s.dueDate), amount: Number(s.amount), description: s.description })),
    };

    const url = mode === "create" ? "/api/orders" : `/api/orders/${orderId}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({}));

    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }

    router.push(`/app/siparisler/${body.id ?? orderId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.document.customer}</label>
          <select
            required
            disabled={!!quoteId}
            value={values.customerId}
            onChange={(e) => setValues((v) => ({ ...v, customerId: e.target.value }))}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:bg-gray-100"
          >
            <option value="">—</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.document.orderDate}</label>
          <input
            type="date"
            required
            value={values.orderDate}
            onChange={(e) => setValues((v) => ({ ...v, orderDate: e.target.value }))}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.document.dueDate}</label>
          <input
            type="date"
            value={values.dueDate}
            onChange={(e) => setValues((v) => ({ ...v, dueDate: e.target.value }))}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>

        {canAssignOwner && (
          <div>
            <label className="block text-sm font-medium text-gray-700">{tr.document.owner}</label>
            <select
              value={values.ownerUserId}
              onChange={(e) => setValues((v) => ({ ...v, ownerUserId: e.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            >
              <option value="">—</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">{tr.document.deliveryAddress}</label>
          <textarea
            value={values.deliveryAddress}
            onChange={(e) => setValues((v) => ({ ...v, deliveryAddress: e.target.value }))}
            rows={2}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">{tr.document.note}</label>
          <textarea
            value={values.note}
            onChange={(e) => setValues((v) => ({ ...v, note: e.target.value }))}
            rows={2}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>
      </div>

      <LineItemEditor
        items={values.items}
        onChange={(items) => setValues((v) => ({ ...v, items }))}
        products={products}
        documentDiscountType={values.documentDiscountType}
        documentDiscountValue={values.documentDiscountValue}
        onDocumentDiscountChange={(type, value) => setValues((v) => ({ ...v, documentDiscountType: type, documentDiscountValue: value }))}
      />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">{tr.order.paymentSchedule}</h2>
          <button type="button" onClick={addSchedule} className="text-xs font-medium text-gray-600 hover:text-gray-900">
            + Taksit ekle
          </button>
        </div>
        <div className="space-y-2">
          {values.paymentSchedules.map((s, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 rounded-md border border-gray-200 p-2 sm:grid-cols-4">
              <input
                type="date"
                value={s.dueDate}
                onChange={(e) => updateSchedule(i, { dueDate: e.target.value })}
                className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
              />
              <input
                type="number"
                step="any"
                placeholder="Tutar"
                value={s.amount}
                onChange={(e) => updateSchedule(i, { amount: e.target.value })}
                className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
              />
              <input
                placeholder="Açıklama (örn. peşinat)"
                value={s.description}
                onChange={(e) => updateSchedule(i, { description: e.target.value })}
                className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
              />
              <button type="button" onClick={() => removeSchedule(i)} className="text-xs text-red-600 hover:underline">
                {tr.customer.contacts.remove}
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? tr.common.loading : tr.common.save}
        </button>
        <button type="button" onClick={() => router.back()} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          {tr.common.cancel}
        </button>
      </div>
    </form>
  );
}
