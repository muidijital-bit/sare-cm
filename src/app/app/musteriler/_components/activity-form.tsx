"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { tr } from "@/lib/i18n/tr";

interface Props {
  customerId: string;
  contacts: { id: string; name: string }[];
}

const TODAY = () => new Date().toISOString().slice(0, 16); // datetime-local için

export function ActivityForm({ customerId, contacts }: Props) {
  const router = useRouter();
  const [type, setType] = useState("PHONE");
  const [occurredAt, setOccurredAt] = useState(TODAY());
  const [contactId, setContactId] = useState("");
  const [note, setNote] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/customers/${customerId}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        occurredAt,
        contactId: contactId || null,
        note,
        nextAction,
        remindAt: remindAt || null,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }

    setNote("");
    setNextAction("");
    setRemindAt("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-4 rounded-md bg-brand-800 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        + {tr.customer.activity.add}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 space-y-3 rounded-md border border-gray-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-gray-700">{tr.customer.activity.type}</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
          >
            {Object.entries(tr.customer.activityType).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">{tr.customer.activity.occurredAt}</label>
          <input
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
          />
        </div>
        {contacts.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-700">İlgili kişi</label>
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
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
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700">{tr.customer.activity.note}</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-gray-700">{tr.customer.activity.nextAction}</label>
          <input
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">{tr.customer.activity.remindAt}</label>
          <input
            type="date"
            value={remindAt}
            onChange={(e) => setRemindAt(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-brand-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? tr.common.loading : tr.common.save}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          {tr.common.cancel}
        </button>
      </div>
    </form>
  );
}
