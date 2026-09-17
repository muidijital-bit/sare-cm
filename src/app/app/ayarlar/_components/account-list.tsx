"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { tr } from "@/lib/i18n/tr";

interface Props {
  items: { id: string; name: string; type: "CASH" | "BANK" }[];
}

export function AccountList({ items }: Props) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"CASH" | "BANK">("CASH");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function addItem() {
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName.trim(), type: newType }) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }
    setNewName("");
    router.refresh();
  }

  async function removeItem(id: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">{tr.settings.accounts}</h2>
      <ul className="mb-3 space-y-1">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-1.5 text-sm">
            <span className="text-gray-900">
              {item.name} <span className="text-xs text-gray-400">({item.type === "CASH" ? "Kasa" : "Banka"})</span>
            </span>
            <button onClick={() => removeItem(item.id)} disabled={busy} className="text-xs text-red-600 hover:underline disabled:opacity-50">
              {tr.customer.delete}
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-gray-400">—</li>}
      </ul>
      <div className="flex gap-2">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={tr.settings.namePlaceholder} className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900" />
        <select value={newType} onChange={(e) => setNewType(e.target.value as "CASH" | "BANK")} className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900">
          <option value="CASH">Kasa</option>
          <option value="BANK">Banka</option>
        </select>
        <button onClick={addItem} disabled={busy} className="rounded-md bg-brand-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          + {tr.settings.add}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
