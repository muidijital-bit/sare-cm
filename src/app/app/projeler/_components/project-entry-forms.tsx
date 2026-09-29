"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { tr, formatCurrencyTRY } from "@/lib/i18n/tr";
import { confirmDelete, notifyError } from "@/lib/ui/sweetalert";

const INPUT =
  "w-full rounded-lg border border-gray-300 bg-white focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 px-3 py-2 text-sm text-gray-900";
const today = () => new Date().toISOString().slice(0, 10);

async function post(url: string, payload: unknown): Promise<string | null> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (res.ok) return null;
  const body = await res.json().catch(() => ({}));
  return body.error ?? tr.common.error;
}

/** Malzeme kullanımı ekleme — kaydedilince stoktan düşer. */
export function MaterialEntryForm({
  projectId,
  products,
}: {
  projectId: string;
  products: { id: string; name: string; unit: string; defaultCost: number | null; stockQty: number }[];
}) {
  const router = useRouter();
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [usedAt, setUsedAt] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const selected = products.find((p) => p.id === productId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const err = await post(`/api/projects/${projectId}/materials`, {
      productId,
      quantity: Number(quantity),
      unitCost: unitCost === "" ? null : Number(unitCost),
      usedAt,
    });
    setSaving(false);
    if (err) return setError(err);
    setProductId("");
    setQuantity("1");
    setUnitCost("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3 border-t border-gray-100 bg-gray-50/60 p-4 sm:grid-cols-12">
      <div className="col-span-2 sm:col-span-4">
        <label className="mb-1 block text-xs font-medium text-gray-600">{tr.project.materials.product}</label>
        <select required value={productId} onChange={(e) => setProductId(e.target.value)} className={INPUT}>
          <option value="">—</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} (stok: {p.stockQty} {p.unit})
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-gray-600">{tr.project.materials.quantity}</label>
        <input required type="number" step="0.01" min="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={INPUT} />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-gray-600">{tr.project.materials.unitCost}</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={unitCost}
          onChange={(e) => setUnitCost(e.target.value)}
          placeholder={selected?.defaultCost != null ? String(selected.defaultCost) : "0"}
          title={tr.project.materials.unitCostHint}
          className={INPUT}
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-gray-600">{tr.project.materials.usedAt}</label>
        <input required type="date" value={usedAt} onChange={(e) => setUsedAt(e.target.value)} className={INPUT} />
      </div>
      <div className="col-span-2 flex items-end sm:col-span-2">
        <button type="submit" disabled={saving} className="w-full rounded-lg bg-brand-800 px-3 py-2 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-700 disabled:opacity-50">
          {saving ? tr.common.loading : `+ ${tr.project.materials.add}`}
        </button>
      </div>
      {error && <p className="col-span-2 text-sm text-red-600 sm:col-span-12">{error}</p>}
    </form>
  );
}

/** İşçilik ekleme — personel seçilirse saatlik maliyet brüt maaş / 225 saat ile önerilir. */
export function LaborEntryForm({
  projectId,
  employees,
}: {
  projectId: string;
  employees: { id: string; fullName: string; suggestedHourlyCost: number }[];
}) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState("");
  const [description, setDescription] = useState("");
  const [workDate, setWorkDate] = useState(today());
  const [hours, setHours] = useState("8");
  const [hourlyCost, setHourlyCost] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function pickEmployee(id: string) {
    setEmployeeId(id);
    const emp = employees.find((e) => e.id === id);
    if (emp) {
      setHourlyCost(emp.suggestedHourlyCost.toFixed(2));
      if (!description) setDescription("Montaj / uygulama");
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const err = await post(`/api/projects/${projectId}/labors`, {
      employeeId: employeeId || null,
      description,
      workDate,
      hours: Number(hours),
      hourlyCost: Number(hourlyCost) || 0,
    });
    setSaving(false);
    if (err) return setError(err);
    setDescription("");
    setHours("8");
    router.refresh();
  }

  const lineCost = (Number(hours) || 0) * (Number(hourlyCost) || 0);

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3 border-t border-gray-100 bg-gray-50/60 p-4 sm:grid-cols-12">
      <div className="col-span-2 sm:col-span-3">
        <label className="mb-1 block text-xs font-medium text-gray-600">{tr.project.labors.employee}</label>
        <select value={employeeId} onChange={(e) => pickEmployee(e.target.value)} className={INPUT}>
          <option value="">{tr.project.labors.noEmployee}</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.fullName}
            </option>
          ))}
        </select>
      </div>
      <div className="col-span-2 sm:col-span-3">
        <label className="mb-1 block text-xs font-medium text-gray-600">{tr.project.labors.description}</label>
        <input required value={description} onChange={(e) => setDescription(e.target.value)} className={INPUT} />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-gray-600">{tr.project.labors.workDate}</label>
        <input required type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} className={INPUT} />
      </div>
      <div className="sm:col-span-1">
        <label className="mb-1 block text-xs font-medium text-gray-600">{tr.project.labors.hours}</label>
        <input required type="number" step="0.5" min="0.5" value={hours} onChange={(e) => setHours(e.target.value)} className={INPUT} />
      </div>
      <div className="sm:col-span-1">
        <label className="mb-1 block text-xs font-medium text-gray-600">{tr.project.labors.hourlyCost}</label>
        <input required type="number" step="0.01" min="0" value={hourlyCost} onChange={(e) => setHourlyCost(e.target.value)} className={INPUT} />
      </div>
      <div className="col-span-2 flex flex-col justify-end sm:col-span-2">
        <button type="submit" disabled={saving} className="w-full rounded-lg bg-brand-800 px-3 py-2 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-700 disabled:opacity-50">
          {saving ? tr.common.loading : `+ ${tr.project.labors.add}`}
        </button>
      </div>
      <p className="col-span-2 text-xs text-gray-500 sm:col-span-12">
        Bu satırın maliyeti: <span className="font-medium text-gray-700">{formatCurrencyTRY(lineCost)}</span>
        {employeeId && " · saatlik maliyet personelin brüt maaşından (÷225 saat) önerildi, değiştirebilirsiniz."}
      </p>
      {error && <p className="col-span-2 text-sm text-red-600 sm:col-span-12">{error}</p>}
    </form>
  );
}

/** Proje silme — başarıda listeye döner (RowDeleteButton yalnızca sayfayı yeniler). */
export function ProjectDeleteButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function handle() {
    if (!(await confirmDelete(tr.project.deleteConfirm))) return;
    setBusy(true);
    const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return notifyError(body.error ?? tr.common.error);
    router.push("/app/projeler");
    router.refresh();
  }
  return (
    <button onClick={handle} disabled={busy} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
      {tr.project.delete}
    </button>
  );
}
