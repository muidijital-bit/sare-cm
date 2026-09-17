"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { tr, formatCurrencyTRY } from "@/lib/i18n/tr";

interface Plan {
  id: string;
  name: string;
  maxUsers: number;
  maxCustomers: number;
  maxStorageMb: number;
  price: string;
}

export function PlanList({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [maxUsers, setMaxUsers] = useState("5");
  const [maxCustomers, setMaxCustomers] = useState("500");
  const [maxStorageMb, setMaxStorageMb] = useState("1024");
  const [price, setPrice] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const res = await fetch("/api/platform/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, maxUsers: Number(maxUsers), maxCustomers: Number(maxCustomers), maxStorageMb: Number(maxStorageMb), price: Number(price) }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }

    setName("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="rounded-lg border border-brand-800 bg-brand-900/50 p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">{tr.platform.newPlan}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <input required placeholder={tr.platform.planName} value={name} onChange={(e) => setName(e.target.value)} className="rounded-md border border-brand-700 bg-white px-2 py-1.5 text-sm text-gray-900 sm:col-span-2" />
          <input type="number" min="1" placeholder={tr.platform.maxUsers} value={maxUsers} onChange={(e) => setMaxUsers(e.target.value)} className="rounded-md border border-brand-700 bg-white px-2 py-1.5 text-sm text-gray-900" />
          <input type="number" min="1" placeholder={tr.platform.maxCustomers} value={maxCustomers} onChange={(e) => setMaxCustomers(e.target.value)} className="rounded-md border border-brand-700 bg-white px-2 py-1.5 text-sm text-gray-900" />
          <input type="number" min="1" placeholder={tr.platform.maxStorageMb} value={maxStorageMb} onChange={(e) => setMaxStorageMb(e.target.value)} className="rounded-md border border-brand-700 bg-white px-2 py-1.5 text-sm text-gray-900" />
          <input type="number" min="0" step="any" placeholder={tr.platform.price} value={price} onChange={(e) => setPrice(e.target.value)} className="rounded-md border border-brand-700 bg-white px-2 py-1.5 text-sm text-gray-900" />
        </div>
        <button type="submit" disabled={saving} className="mt-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-brand-900 hover:bg-brand-50 disabled:opacity-50">
          {saving ? tr.common.loading : tr.platform.newPlan}
        </button>
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      </form>

      <div className="overflow-x-auto rounded-lg border border-brand-800">
        <table className="min-w-full divide-y divide-brand-800 text-sm">
          <thead className="bg-brand-900 text-left text-xs font-medium uppercase tracking-wide text-brand-300">
            <tr>
              <th className="px-4 py-3">{tr.platform.planName}</th>
              <th className="px-4 py-3">{tr.platform.maxUsers}</th>
              <th className="px-4 py-3">{tr.platform.maxCustomers}</th>
              <th className="px-4 py-3">{tr.platform.maxStorageMb}</th>
              <th className="px-4 py-3">{tr.platform.price}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-900">
            {plans.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-medium text-white">{p.name}</td>
                <td className="px-4 py-3 text-brand-200">{p.maxUsers}</td>
                <td className="px-4 py-3 text-brand-200">{p.maxCustomers}</td>
                <td className="px-4 py-3 text-brand-200">{p.maxStorageMb}</td>
                <td className="px-4 py-3 text-brand-200">{formatCurrencyTRY(Number(p.price))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
