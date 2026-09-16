"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { tr } from "@/lib/i18n/tr";
import type { CustomerInput } from "@/lib/validation/customer";

export interface CustomerFormContact {
  id?: string;
  name: string;
  position: string;
  phone: string;
  email: string;
  isPrimary: boolean;
}

export interface CustomerFormValues {
  type: "INDIVIDUAL" | "CORPORATE";
  title: string;
  taxOffice: string;
  taxNumber: string;
  address: string;
  sourceId: string;
  status: "POTENTIAL" | "ACTIVE" | "PASSIVE" | "LOST";
  ownerUserId: string;
  tags: string; // virgülle ayrılmış, form içinde düz metin olarak tutulur
  contacts: CustomerFormContact[];
}

const EMPTY_VALUES: CustomerFormValues = {
  type: "CORPORATE",
  title: "",
  taxOffice: "",
  taxNumber: "",
  address: "",
  sourceId: "",
  status: "POTENTIAL",
  ownerUserId: "",
  tags: "",
  contacts: [],
};

interface Props {
  mode: "create" | "edit";
  customerId?: string;
  initialValues?: Partial<CustomerFormValues>;
  sources: { id: string; name: string }[];
  users: { id: string; name: string }[];
  canAssignOwner: boolean;
}

export function CustomerForm({ mode, customerId, initialValues, sources, users, canAssignOwner }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<CustomerFormValues>({ ...EMPTY_VALUES, ...initialValues });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateContact(index: number, patch: Partial<CustomerFormContact>) {
    setValues((v) => ({
      ...v,
      contacts: v.contacts.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  }

  function addContact() {
    setValues((v) => ({
      ...v,
      contacts: [...v.contacts, { name: "", position: "", phone: "", email: "", isPrimary: v.contacts.length === 0 }],
    }));
  }

  function removeContact(index: number) {
    setValues((v) => ({ ...v, contacts: v.contacts.filter((_, i) => i !== index) }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload: CustomerInput = {
      type: values.type,
      title: values.title,
      taxOffice: values.taxOffice,
      taxNumber: values.taxNumber,
      address: values.address,
      sourceId: values.sourceId || null,
      status: values.status,
      ownerUserId: values.ownerUserId || null,
      tags: values.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      contacts: values.contacts
        .filter((c) => c.name.trim())
        .map((c) => ({ ...c, id: c.id })),
    };

    const url = mode === "create" ? "/api/customers" : `/api/customers/${customerId}`;
    const method = mode === "create" ? "POST" : "PATCH";

    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({}));

    setSaving(false);

    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }

    router.push(`/app/musteriler/${body.id ?? customerId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.customer.fields.type}</label>
          <select
            value={values.type}
            onChange={(e) => setValues((v) => ({ ...v, type: e.target.value as CustomerFormValues["type"] }))}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            {Object.entries(tr.customer.type).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.customer.fields.status}</label>
          <select
            value={values.status}
            onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as CustomerFormValues["status"] }))}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            {Object.entries(tr.customer.status).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">{tr.customer.fields.title}</label>
          <input
            required
            value={values.title}
            onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.customer.fields.taxOffice}</label>
          <input
            value={values.taxOffice}
            onChange={(e) => setValues((v) => ({ ...v, taxOffice: e.target.value }))}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.customer.fields.taxNumber}</label>
          <input
            value={values.taxNumber}
            onChange={(e) => setValues((v) => ({ ...v, taxNumber: e.target.value }))}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">{tr.customer.fields.address}</label>
          <textarea
            value={values.address}
            onChange={(e) => setValues((v) => ({ ...v, address: e.target.value }))}
            rows={2}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.customer.fields.source}</label>
          <select
            value={values.sourceId}
            onChange={(e) => setValues((v) => ({ ...v, sourceId: e.target.value }))}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="">—</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {canAssignOwner && (
          <div>
            <label className="block text-sm font-medium text-gray-700">{tr.customer.fields.owner}</label>
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
          <label className="block text-sm font-medium text-gray-700">{tr.customer.fields.tags}</label>
          <input
            value={values.tags}
            onChange={(e) => setValues((v) => ({ ...v, tags: e.target.value }))}
            placeholder={tr.customer.fields.tagsHint}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">{tr.customer.contacts.title}</h2>
          <button type="button" onClick={addContact} className="text-xs font-medium text-gray-600 hover:text-gray-900">
            + {tr.customer.contacts.add}
          </button>
        </div>

        <div className="space-y-3">
          {values.contacts.map((contact, i) => (
            <div key={contact.id ?? i} className="grid grid-cols-1 gap-2 rounded-md border border-gray-200 p-3 sm:grid-cols-5">
              <input
                placeholder={tr.customer.contacts.name}
                value={contact.name}
                onChange={(e) => updateContact(i, { name: e.target.value })}
                className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 sm:col-span-1"
              />
              <input
                placeholder={tr.customer.contacts.position}
                value={contact.position}
                onChange={(e) => updateContact(i, { position: e.target.value })}
                className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 sm:col-span-1"
              />
              <input
                placeholder={tr.customer.contacts.phone}
                value={contact.phone}
                onChange={(e) => updateContact(i, { phone: e.target.value })}
                className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 sm:col-span-1"
              />
              <input
                placeholder={tr.customer.contacts.email}
                value={contact.email}
                onChange={(e) => updateContact(i, { email: e.target.value })}
                className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 sm:col-span-1"
              />
              <div className="flex items-center justify-between gap-2 sm:col-span-1">
                <label className="flex items-center gap-1 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={contact.isPrimary}
                    onChange={(e) => updateContact(i, { isPrimary: e.target.checked })}
                  />
                  {tr.customer.contacts.primary}
                </label>
                <button type="button" onClick={() => removeContact(i)} className="text-xs text-red-600 hover:underline">
                  {tr.customer.contacts.remove}
                </button>
              </div>
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
