"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { tr } from "@/lib/i18n/tr";
import type { LeaveRequestInput } from "@/lib/validation/employee";

export function LeaveForm({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<LeaveRequestInput["type"]>("YILLIK");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [days, setDays] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload: LeaveRequestInput = {
      employeeId,
      type,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      days: Number(days),
      note,
    };

    const res = await fetch("/api/leave-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }
    setOpen(false);
    setStartDate("");
    setEndDate("");
    setDays("");
    setNote("");
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
        + {tr.employee.leave.new}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm sm:grid-cols-5">
      <div>
        <label className="block text-xs font-medium text-gray-700">{tr.employee.leave.fields.type}</label>
        <select value={type} onChange={(e) => setType(e.target.value as LeaveRequestInput["type"])} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm">
          {Object.entries(tr.employee.leave.type).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700">{tr.employee.leave.fields.startDate}</label>
        <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700">{tr.employee.leave.fields.endDate}</label>
        <input required type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700">{tr.employee.leave.fields.days}</label>
        <input required type="number" step="0.5" min="0.5" value={days} onChange={(e) => setDays(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700">{tr.employee.leave.fields.note}</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm" />
      </div>
      {error && <p className="col-span-full text-sm text-red-600">{error}</p>}
      <div className="col-span-full flex gap-2">
        <button type="submit" disabled={saving} className="rounded-md bg-brand-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {saving ? tr.common.loading : tr.common.save}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
          {tr.common.cancel}
        </button>
      </div>
    </form>
  );
}
