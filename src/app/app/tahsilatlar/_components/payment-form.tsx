"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { tr } from "@/lib/i18n/tr";
import type { PaymentInput } from "@/lib/validation/payment";
import type { OpenOrderSummary } from "@/lib/modules/orders/service";

interface AllocationRow {
  orderId: string;
  amount: string;
}

interface Props {
  customers: { id: string; title: string }[];
  accounts: { id: string; name: string }[];
}

const today = () => new Date().toISOString().slice(0, 10);

export function PaymentForm({ customers, accounts }: Props) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [paidAt, setPaidAt] = useState(today());
  const [amount, setAmount] = useState("");
  const [isRefund, setIsRefund] = useState(false);
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [openOrders, setOpenOrders] = useState<OpenOrderSummary[]>([]);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!customerId) {
      setOpenOrders([]);
      return;
    }
    fetch(`/api/customers/${customerId}/open-orders`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setOpenOrders(Array.isArray(data) ? data : []))
      .catch(() => setOpenOrders([]));
  }, [customerId]);

  function addAllocation() {
    setAllocations((a) => [...a, { orderId: "", amount: "" }]);
  }
  function updateAllocation(i: number, patch: Partial<AllocationRow>) {
    setAllocations((a) => a.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function removeAllocation(i: number) {
    setAllocations((a) => a.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const numericAmount = Math.abs(Number(amount)) * (isRefund ? -1 : 1);

    const payload: PaymentInput = {
      customerId,
      accountId,
      paidAt: new Date(paidAt),
      amount: numericAmount,
      method: method as PaymentInput["method"],
      reference,
      note,
      allocations: isRefund
        ? []
        : allocations.filter((a) => a.orderId && Number(a.amount) > 0).map((a) => ({ orderId: a.orderId, amount: Number(a.amount) })),
    };

    const res = await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }

    router.push(`/app/tahsilatlar/${body.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.payment.fields.customer}</label>
          <select
            required
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              setAllocations([]);
            }}
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

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.payment.fields.account}</label>
          <select required value={accountId} onChange={(e) => setAccountId(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
            <option value="">—</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.payment.fields.paidAt}</label>
          <input type="date" required value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.payment.fields.method}</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
            {Object.entries(tr.payment.method).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.payment.fields.amount}</label>
          <input
            type="number"
            step="any"
            required
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
          <label className="mt-1 flex items-center gap-1 text-xs text-gray-600">
            <input type="checkbox" checked={isRefund} onChange={(e) => setIsRefund(e.target.checked)} />
            {tr.payment.isRefund}
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.payment.fields.reference}</label>
          <input value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">
            {tr.payment.fields.note} {isRefund && <span className="text-red-600">*</span>}
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            required={isRefund}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>
      </div>

      {!isRefund && customerId && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">{tr.payment.fields.allocations}</h2>
            <button type="button" onClick={addAllocation} className="text-xs font-medium text-gray-600 hover:text-gray-900" disabled={openOrders.length === 0}>
              + Mahsup ekle
            </button>
          </div>
          {openOrders.length === 0 && <p className="text-xs text-gray-400">Bu müşterinin açık (bakiyeli) siparişi yok — tahsilat cari alacak olarak kalır.</p>}
          <div className="space-y-2">
            {allocations.map((a, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <select
                  value={a.orderId}
                  onChange={(e) => updateAllocation(i, { orderId: e.target.value })}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                >
                  <option value="">—</option>
                  {openOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.number} (kalan: {o.remaining.toFixed(2)})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="any"
                  placeholder="Mahsup tutarı"
                  value={a.amount}
                  onChange={(e) => updateAllocation(i, { amount: e.target.value })}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                />
                <button type="button" onClick={() => removeAllocation(i)} className="text-xs text-red-600 hover:underline">
                  {tr.customer.contacts.remove}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {saving ? tr.common.loading : tr.common.save}
        </button>
        <button type="button" onClick={() => router.back()} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          {tr.common.cancel}
        </button>
      </div>
    </form>
  );
}
