"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { tr } from "@/lib/i18n/tr";
import { LineItemEditor, emptyLineItem, type LineItemRow, type ProductOption } from "@/components/documents/line-item-editor";
import type { QuoteInput } from "@/lib/validation/quote";

export interface QuoteFormValues {
  customerId: string;
  contactId: string;
  issueDate: string;
  validUntil: string;
  ownerUserId: string;
  note: string;
  documentDiscountType: "PERCENT" | "AMOUNT";
  documentDiscountValue: string;
  items: LineItemRow[];
}

const today = () => new Date().toISOString().slice(0, 10);
const plus15Days = () => new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const EMPTY_VALUES: QuoteFormValues = {
  customerId: "",
  contactId: "",
  issueDate: today(),
  validUntil: plus15Days(),
  ownerUserId: "",
  note: "",
  documentDiscountType: "PERCENT",
  documentDiscountValue: "0",
  items: [emptyLineItem()],
};

interface Props {
  mode: "create" | "edit";
  quoteId?: string;
  initialValues?: Partial<QuoteFormValues>;
  customers: { id: string; title: string }[];
  products: ProductOption[];
  users: { id: string; name: string }[];
  canAssignOwner: boolean;
}

export function QuoteForm({ mode, quoteId, initialValues, customers, products, users, canAssignOwner }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<QuoteFormValues>({ ...EMPTY_VALUES, ...initialValues });
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!values.customerId) {
      setContacts([]);
      return;
    }
    fetch(`/api/customers/${values.customerId}`)
      .then((r) => (r.ok ? r.json() : { contacts: [] }))
      .then((data) => setContacts(data.contacts ?? []))
      .catch(() => setContacts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.customerId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!values.customerId) {
      setError("Müşteri seçin.");
      return;
    }
    setSaving(true);

    const payload: QuoteInput = {
      customerId: values.customerId,
      contactId: values.contactId || null,
      issueDate: new Date(values.issueDate),
      validUntil: new Date(values.validUntil),
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
    };

    const url = mode === "create" ? "/api/quotes" : `/api/quotes/${quoteId}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({}));

    setSaving(false);

    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }

    router.push(`/app/teklifler/${body.id ?? quoteId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.document.customer}</label>
          <select
            required
            value={values.customerId}
            onChange={(e) => setValues((v) => ({ ...v, customerId: e.target.value, contactId: "" }))}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="">—</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        {contacts.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700">{tr.document.contact}</label>
            <select
              value={values.contactId}
              onChange={(e) => setValues((v) => ({ ...v, contactId: e.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            >
              <option value="">—</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.document.issueDate}</label>
          <input
            type="date"
            required
            value={values.issueDate}
            onChange={(e) => setValues((v) => ({ ...v, issueDate: e.target.value }))}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.document.validUntil}</label>
          <input
            type="date"
            required
            value={values.validUntil}
            onChange={(e) => setValues((v) => ({ ...v, validUntil: e.target.value }))}
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? tr.common.loading : tr.common.save}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {tr.common.cancel}
        </button>
      </div>
    </form>
  );
}
