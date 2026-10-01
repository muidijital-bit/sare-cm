"use client";

import { useRef, useState } from "react";
import { Upload } from "react-feather";
import { parseWorkbook, type RawSheet } from "@/lib/modules/quote-templates/parse";
import type { WorkbookContent } from "@/lib/modules/quote-templates/types";
import { sheetTotals } from "@/lib/modules/quote-templates/calc";
import { formatCurrencyTRY } from "@/lib/i18n/tr";

/**
 * Excel'den (.xls/.xlsx, çok sayfalı) şablon içeriği içe aktarma. Dosya TARAYICIDA okunur (SheetJS,
 * yalnızca bu düğmeye basılınca yüklenir) — sunucuya gönderilmez. Önizleme gösterilir; kullanıcı
 * sayfaları seçip "Aktar" der.
 */
export function ImportExcelButton({ onImport, label = "Excel'den içe aktar" }: { onImport: (c: WorkbookContent, opts: { replace: boolean }) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ content: WorkbookContent; warnings: string[]; fileName: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [replace, setReplace] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const raw: RawSheet[] = wb.SheetNames.map((name) => ({
        name,
        rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: true }) as RawSheet["rows"],
      }));
      const res = parseWorkbook(raw);
      setPreview({ ...res, fileName: file.name });
      setSelected(new Set(res.content.sheets.map((s) => s.name)));
    } catch (e) {
      setError(`Dosya okunamadı: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  function apply() {
    if (!preview) return;
    const content = { ...preview.content, sheets: preview.content.sheets.filter((s) => selected.has(s.name)) };
    onImport(content, { replace });
    setPreview(null);
  }

  return (
    <>
      <input ref={input} type="file" accept=".xls,.xlsx,.xlsm" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
      >
        <Upload size={15} /> {busy ? "Okunuyor…" : label}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPreview(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900">İçe aktarma önizlemesi</h3>
            <p className="mt-1 text-sm text-gray-500">{preview.fileName}</p>

            <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm">
              <p className="font-medium text-gray-800">Antet ve kapak</p>
              <p className="text-gray-600">
                {preview.content.branding.companyTitle || "—"} · {preview.content.branding.phone || "tel yok"} · {preview.content.branding.email || "e-posta yok"}
              </p>
              <p className="text-gray-600">
                İmza: {preview.content.cover.signatureName || "—"} · Not: {preview.content.cover.notes.length} · Giriş metni: {preview.content.cover.intro ? "var" : "yok"}
              </p>
            </div>

            <p className="mt-4 text-sm font-medium text-gray-800">Sayfalar ({preview.content.sheets.length})</p>
            <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-200 text-sm">
              {preview.content.sheets.map((s) => {
                const t = sheetTotals(s);
                return (
                  <li key={s.name} className="flex items-center gap-3 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(s.name)}
                      onChange={(e) => {
                        const n = new Set(selected);
                        if (e.target.checked) n.add(s.name);
                        else n.delete(s.name);
                        setSelected(n);
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-900">{s.name}</p>
                      <p className="truncate text-xs text-gray-500">
                        {s.title} · {s.groups.length} grup · {t.itemCount} kalem · {s.specs.length} özellik
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-gray-700">{t.total > 0 ? formatCurrencyTRY(t.total) : "—"}</span>
                  </li>
                );
              })}
            </ul>
            {preview.warnings.length > 0 && <p className="mt-2 text-xs text-amber-700">{preview.warnings.join(" ")}</p>}

            <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
              Mevcut sayfaların yerine koy (işaretsizse sona ekler). Antet/kapak boş alanlar doldurulur.
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPreview(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Vazgeç
              </button>
              <button type="button" onClick={apply} disabled={selected.size === 0} className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                {selected.size} sayfayı aktar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
