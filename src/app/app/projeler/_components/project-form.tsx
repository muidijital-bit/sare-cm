"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { tr } from "@/lib/i18n/tr";
import { PROJECT_STATUSES, type ProjectInput } from "@/lib/validation/project";

export interface ProjectFormValues {
  name: string;
  customerId: string;
  status: ProjectInput["status"];
  location: string;
  startDate: string;
  endDate: string;
  contractAmount: string;
  note: string;
}

const EMPTY_VALUES: ProjectFormValues = {
  name: "",
  customerId: "",
  status: "PLANNED",
  location: "",
  startDate: "",
  endDate: "",
  contractAmount: "0",
  note: "",
};

interface Props {
  mode: "create" | "edit";
  projectId?: string;
  initialValues?: Partial<ProjectFormValues>;
  customers: { id: string; title: string }[];
}

const INPUT =
  "mt-1 w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-3 py-2 text-sm text-gray-900";

export function ProjectForm({ mode, projectId, initialValues, customers }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<ProjectFormValues>({ ...EMPTY_VALUES, ...initialValues });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<ProjectFormValues>) => setValues((v) => ({ ...v, ...patch }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!values.customerId) {
      setError("Müşteri seçin.");
      return;
    }
    setSaving(true);

    const payload = {
      name: values.name,
      customerId: values.customerId,
      status: values.status,
      location: values.location,
      startDate: values.startDate || null,
      endDate: values.endDate || null,
      contractAmount: Number(values.contractAmount) || 0,
      note: values.note,
    };

    const url = mode === "create" ? "/api/projects" : `/api/projects/${projectId}`;
    const method = mode === "create" ? "POST" : "PUT";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({}));

    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }
    router.push(`/app/projeler/${body.id ?? projectId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">{tr.project.fields.name}</label>
          <input required value={values.name} onChange={(e) => set({ name: e.target.value })} placeholder="Örn. Yılmaz Villası — 8x4 havuz" className={INPUT} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.project.fields.customer}</label>
          <select required value={values.customerId} onChange={(e) => set({ customerId: e.target.value })} className={INPUT}>
            <option value="">—</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.project.fields.status}</label>
          <select value={values.status} onChange={(e) => set({ status: e.target.value as ProjectFormValues["status"] })} className={INPUT}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {tr.project.status[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">{tr.project.fields.location}</label>
          <input value={values.location} onChange={(e) => set({ location: e.target.value })} className={INPUT} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.project.fields.startDate}</label>
          <input type="date" value={values.startDate} onChange={(e) => set({ startDate: e.target.value })} className={INPUT} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.project.fields.endDate}</label>
          <input type="date" value={values.endDate} onChange={(e) => set({ endDate: e.target.value })} className={INPUT} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr.project.fields.contractAmount}</label>
          <input type="number" step="0.01" min="0" value={values.contractAmount} onChange={(e) => set({ contractAmount: e.target.value })} className={INPUT} />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">{tr.project.fields.note}</label>
          <textarea rows={3} value={values.note} onChange={(e) => set({ note: e.target.value })} className={INPUT} />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="rounded-lg bg-brand-800 shadow-theme-xs px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {saving ? tr.common.loading : tr.common.save}
        </button>
        <button type="button" onClick={() => router.back()} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          {tr.common.cancel}
        </button>
      </div>
    </form>
  );
}
