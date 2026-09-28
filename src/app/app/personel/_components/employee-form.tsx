"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { tr } from "@/lib/i18n/tr";
import type { EmployeeInput } from "@/lib/validation/employee";

export interface EmployeeFormValues {
  fullName: string;
  nationalId: string;
  position: string;
  department: string;
  phone: string;
  email: string;
  hireDate: string;
  terminationDate: string;
  sgkSicilNo: string;
  iban: string;
  grossSalary: string;
  status: "ACTIVE" | "ON_LEAVE" | "TERMINATED";
  note: string;
}

const EMPTY_VALUES: EmployeeFormValues = {
  fullName: "",
  nationalId: "",
  position: "",
  department: "",
  phone: "",
  email: "",
  hireDate: "",
  terminationDate: "",
  sgkSicilNo: "",
  iban: "",
  grossSalary: "",
  status: "ACTIVE",
  note: "",
};

interface Props {
  mode: "create" | "edit";
  employeeId?: string;
  initialValues?: Partial<EmployeeFormValues>;
}

export function EmployeeForm({ mode, employeeId, initialValues }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<EmployeeFormValues>({ ...EMPTY_VALUES, ...initialValues });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload: EmployeeInput = {
      fullName: values.fullName,
      nationalId: values.nationalId,
      position: values.position,
      department: values.department,
      phone: values.phone,
      email: values.email,
      hireDate: new Date(values.hireDate),
      terminationDate: values.terminationDate ? new Date(values.terminationDate) : null,
      sgkSicilNo: values.sgkSicilNo,
      iban: values.iban,
      grossSalary: Number(values.grossSalary),
      status: values.status,
      note: values.note,
    };

    const url = mode === "create" ? "/api/employees" : `/api/employees/${employeeId}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({}));

    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }

    router.push(mode === "create" ? "/app/personel" : `/app/personel/${employeeId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">{tr.employee.fields.fullName}</label>
          <input
            required
            value={values.fullName}
            onChange={(e) => setValues((v) => ({ ...v, fullName: e.target.value }))}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.employee.fields.nationalId}</label>
          <input
            value={values.nationalId}
            onChange={(e) => setValues((v) => ({ ...v, nationalId: e.target.value }))}
            maxLength={11}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.employee.fields.position}</label>
          <input
            value={values.position}
            onChange={(e) => setValues((v) => ({ ...v, position: e.target.value }))}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.employee.fields.department}</label>
          <input
            value={values.department}
            onChange={(e) => setValues((v) => ({ ...v, department: e.target.value }))}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.employee.fields.status}</label>
          <select
            value={values.status}
            onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as EmployeeFormValues["status"] }))}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            {Object.entries(tr.employee.status).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.employee.fields.phone}</label>
          <input
            value={values.phone}
            onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.employee.fields.email}</label>
          <input
            type="email"
            value={values.email}
            onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.employee.fields.hireDate}</label>
          <input
            required
            type="date"
            value={values.hireDate}
            onChange={(e) => setValues((v) => ({ ...v, hireDate: e.target.value }))}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.employee.fields.terminationDate}</label>
          <input
            type="date"
            value={values.terminationDate}
            onChange={(e) => setValues((v) => ({ ...v, terminationDate: e.target.value }))}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.employee.fields.sgkSicilNo}</label>
          <input
            value={values.sgkSicilNo}
            onChange={(e) => setValues((v) => ({ ...v, sgkSicilNo: e.target.value }))}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.employee.fields.iban}</label>
          <input
            value={values.iban}
            onChange={(e) => setValues((v) => ({ ...v, iban: e.target.value }))}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.employee.fields.grossSalary}</label>
          <input
            required
            type="number"
            step="0.01"
            min="0"
            value={values.grossSalary}
            onChange={(e) => setValues((v) => ({ ...v, grossSalary: e.target.value }))}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">{tr.employee.fields.note}</label>
          <textarea
            rows={2}
            value={values.note}
            onChange={(e) => setValues((v) => ({ ...v, note: e.target.value }))}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>
      </div>

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
