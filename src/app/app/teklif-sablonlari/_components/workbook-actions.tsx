"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, Download, Edit2, FilePlus, Trash2 } from "react-feather";
import { confirmDelete, notifyError } from "@/lib/ui/sweetalert";

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "İşlem başarısız.");
  return json;
}

/** Şablon satırı: teklif hazırla (müşteri + sayfa seçimi), kopyala, Excel, sil. */
export function TemplateRowActions({
  id,
  sheetNames,
  customers,
  canPrepare,
  canManage,
}: {
  id: string;
  sheetNames: string[];
  customers: { id: string; title: string }[];
  canPrepare: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set(sheetNames));
  const [busy, setBusy] = useState(false);

  async function prepare() {
    if (!customerId) return notifyError("Müşteri seçin.");
    setBusy(true);
    try {
      const r = await call(`/api/quote-templates/${id}/prepare`, "POST", { customerId, sheetNames: Array.from(selected) });
      router.push(`/app/teklif-sablonlari/${r.id}`);
    } catch (e) {
      setBusy(false);
      notifyError((e as Error).message);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {canPrepare && (
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-lg bg-brand-800 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
          <FilePlus size={13} /> Teklif hazırla
        </button>
      )}
      <a href={`/api/quote-templates/${id}/export?mode=customer`} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50" title="Excel (müşteri sürümü)">
        <Download size={13} /> Excel
      </a>
      <Link
        href={`/app/teklif-sablonlari/${id}`}
        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        title={canManage ? "Şablonu düzenle" : "Şablonu görüntüle"}
      >
        <Edit2 size={13} /> {canManage ? "Düzenle" : "Görüntüle"}
      </Link>
      {canManage && (
        <>
          <button
            onClick={async () => {
              try {
                const r = await call(`/api/quote-templates/${id}/duplicate`, "POST");
                router.push(`/app/teklif-sablonlari/${r.id}`);
              } catch (e) {
                notifyError((e as Error).message);
              }
            }}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50"
            title="Kopyala"
            aria-label="Kopyala"
          >
            <Copy size={14} />
          </button>
          <DeleteButton id={id} label="Şablon silinsin mi? Bu şablondan hazırlanmış teklifler etkilenmez." />
        </>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 text-left shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900">Şablondan teklif hazırla</h3>
            <p className="mt-1 text-sm text-gray-500">Antet, kapak ve seçtiğiniz sayfalar kopyalanır; müşteri bilgileri otomatik dolar. Miktar ve fiyatları sonra düzenleyebilirsiniz.</p>
            <label className="mt-4 mb-1 block text-xs font-medium text-gray-600">Müşteri</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">— Müşteri seçin —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <p className="mt-4 mb-1 text-xs font-medium text-gray-600">Teklife girecek sayfalar</p>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-gray-200 p-2">
              {sheetNames.map((n) => (
                <label key={n} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selected.has(n)}
                    onChange={(e) => {
                      const s = new Set(selected);
                      if (e.target.checked) s.add(n);
                      else s.delete(n);
                      setSelected(s);
                    }}
                  />
                  {n}
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button disabled={busy} onClick={() => setOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700">
                Vazgeç
              </button>
              <button disabled={busy || selected.size === 0} onClick={prepare} className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {busy ? "Hazırlanıyor…" : "Hazırla"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function DeleteButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        if (!(await confirmDelete(label))) return;
        try {
          await call(`/api/quote-templates/${id}`, "DELETE");
          router.refresh();
        } catch (e) {
          notifyError((e as Error).message);
        }
      }}
      className="rounded-lg border border-red-100 p-1.5 text-red-500 hover:bg-red-50"
      title="Sil"
      aria-label="Sil"
    >
      <Trash2 size={14} />
    </button>
  );
}
