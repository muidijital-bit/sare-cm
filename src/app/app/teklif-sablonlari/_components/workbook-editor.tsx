"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Download, FileText, Plus, Trash2, X } from "react-feather";
import { formatCurrencyTRY } from "@/lib/i18n/tr";
import { notifyError, confirmDelete } from "@/lib/ui/sweetalert";
import { isLightLogo, prepareLogo, readFileAsDataUrl, withDarkBackground } from "@/lib/ui/logo";
import {
  CURRENCIES,
  emptySheet,
  type TemplateGroup,
  type TemplateItem,
  type TemplateSheet,
  type WorkbookContent,
} from "@/lib/modules/quote-templates/types";
import { itemLineCost, sheetTotals, workbookTotal } from "@/lib/modules/quote-templates/calc";
import { ImportExcelButton } from "./import-excel";

const INPUT = "w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 disabled:bg-gray-50";
const LABEL = "mb-1 block text-xs font-medium text-gray-600";
const CARD = "rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs";

const toNum = (v: string): number | null => {
  const s = v.replace(/\s/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const numStr = (n: number | null | undefined) => (n == null ? "" : String(n));
const emptyItem = (heading = false): TemplateItem => ({ prefix: "", description: "", notes: [], isHeading: heading, quantity: heading ? null : 1, unit: heading ? "" : "AD", listPrice: null, netPrice: null });

export interface EditorProps {
  kind: "TEMPLATE" | "QUOTE";
  id?: string;
  initial: { name: string; description: string; customerId: string | null; content: WorkbookContent; convertedQuoteId?: string | null };
  customers?: { id: string; title: string; address: string | null; phone: string | null; email: string | null }[];
  canEdit: boolean;
  canExportInternal: boolean;
}

export function WorkbookEditor({ kind, id, initial, customers = [], canEdit, canExportInternal }: EditorProps) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [customerId, setCustomerId] = useState(initial.customerId ?? "");
  const [content, setContent] = useState<WorkbookContent>(initial.content);
  const [tab, setTab] = useState<"cover" | number>("cover");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const total = useMemo(() => workbookTotal(content), [content]);
  const ro = !canEdit;

  function update(fn: (c: WorkbookContent) => void) {
    setContent((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
    setDirty(true);
  }
  const updateSheet = (i: number, fn: (s: TemplateSheet) => void) => update((c) => fn(c.sheets[i]));

  async function save(): Promise<string | null> {
    if (!name.trim()) {
      await notifyError("Ad zorunlu.");
      return null;
    }
    setSaving(true);
    const body = { kind, name, description, customerId: kind === "QUOTE" ? customerId || null : null, content };
    const res = await fetch(id ? `/api/quote-templates/${id}` : "/api/quote-templates", {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      await notifyError(json.error ?? "Kaydedilemedi.");
      return null;
    }
    setDirty(false);
    setSavedAt(new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }));
    if (!id) {
      router.replace(`/app/teklif-sablonlari/${json.id}`);
      return json.id;
    }
    router.refresh();
    return id;
  }

  async function exportXlsx(mode: "customer" | "internal") {
    const savedId = dirty || !id ? await save() : id;
    if (savedId) window.location.href = `/api/quote-templates/${savedId}/export?mode=${mode}`;
  }

  async function convert() {
    const savedId = dirty || !id ? await save() : id;
    if (!savedId) return;
    const res = await fetch(`/api/quote-templates/${savedId}/convert`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return notifyError(json.error ?? "Dönüştürülemedi.");
    router.push(`/app/teklifler/${json.quoteId}`);
  }

  function onImport(imported: WorkbookContent, { replace }: { replace: boolean }) {
    update((c) => {
      // Antet/kapak: yalnızca boş alanları doldur (kullanıcının girdiğini ezme).
      for (const k of Object.keys(imported.branding) as (keyof WorkbookContent["branding"])[]) if (!c.branding[k] && imported.branding[k]) c.branding[k] = imported.branding[k];
      const cv = c.cover as Record<string, unknown>;
      for (const [k, v] of Object.entries(imported.cover)) {
        const cur = cv[k];
        if ((Array.isArray(cur) ? cur.length === 0 : !cur) && (Array.isArray(v) ? v.length : v)) cv[k] = v;
      }
      const used = new Set(replace ? [] : c.sheets.map((s) => s.name.toLocaleUpperCase("tr")));
      const incoming = imported.sheets.map((s) => {
        let n = s.name;
        let k = 2;
        while (used.has(n.toLocaleUpperCase("tr"))) n = `${s.name.slice(0, 27)} (${k++})`;
        used.add(n.toLocaleUpperCase("tr"));
        return { ...s, name: n };
      });
      c.sheets = replace ? incoming : [...c.sheets, ...incoming];
    });
    setTab("cover");
  }

  function pickCustomer(cid: string) {
    setCustomerId(cid);
    const cu = customers.find((x) => x.id === cid);
    if (cu)
      update((c) => {
        c.customer.name = cu.title;
        c.customer.address = cu.address ?? "";
        c.customer.phone = cu.phone ?? "";
        c.customer.email = cu.email ?? "";
      });
    else setDirty(true);
  }

  async function onLogo(file: File) {
    if (!/^image\/(png|jpe?g|gif|webp|svg\+xml)$/.test(file.type)) return notifyError("PNG, JPG veya SVG yükleyin.");
    // 600 px'e küçült, beyaz zemini şeffaflaştır, logo kadar kırp. Excel sayfası beyaz olduğundan açık
    // renkli (beyaz) logo koyu, yuvarlatılmış bir zemine oturtulur.
    const { dataUrl, light } = await prepareLogo(await readFileAsDataUrl(file), 600);
    const out = light ? await withDarkBackground(dataUrl) : dataUrl;
    if (out.length > 590_000) return notifyError("Logo çok büyük; daha küçük bir görsel deneyin.");
    update((c) => (c.branding.logoDataUrl = out));
  }

  // Yeni şablon: antete Şirket Ayarları'ndaki logo gelir — açık renkliyse Excel'de görünsün diye koyu zemine oturtulur.
  useEffect(() => {
    const logo = initial.content.branding.logoDataUrl;
    if (id || !logo) return;
    isLightLogo(logo)
      .then(async (light) => {
        if (!light) return;
        const out = await withDarkBackground(logo);
        setContent((prev) => ({ ...prev, branding: { ...prev.branding, logoDataUrl: out } }));
      })
      .catch(() => {});
    // yalnızca ilk açılışta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      {/* Üst çubuk */}
      <div className={`${CARD} flex flex-wrap items-end gap-3`}>
        <div className="min-w-[240px] flex-1">
          <label className={LABEL}>{kind === "TEMPLATE" ? "Şablon adı" : "Teklif adı"}</label>
          <input disabled={ro} value={name} onChange={(e) => (setName(e.target.value), setDirty(true))} className={INPUT} placeholder="Örn. Havuz teklif şablonu 2026" />
        </div>
        <div className="min-w-[200px] flex-1">
          <label className={LABEL}>Açıklama</label>
          <input disabled={ro} value={description} onChange={(e) => (setDescription(e.target.value), setDirty(true))} className={INPUT} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && <ImportExcelButton onImport={onImport} />}
          {canEdit && (
            <button onClick={save} disabled={saving} className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-700 disabled:opacity-50">
              {saving ? "Kaydediliyor…" : dirty || !id ? "Kaydet" : "Kaydedildi ✓"}
            </button>
          )}
          <button onClick={() => exportXlsx("customer")} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            <Download size={14} /> Excel (müşteri)
          </button>
          {canExportInternal && (
            <button onClick={() => exportXlsx("internal")} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50" title="Liste/net alış, kur, işçilik, kâr dökümü — müşteriye göndermeyin">
              <Download size={14} /> Excel (iç)
            </button>
          )}
          {kind === "QUOTE" && canEdit && !initial.convertedQuoteId && (
            <button onClick={convert} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800 hover:bg-brand-100">
              <FileText size={14} /> Satış teklifine dönüştür
            </button>
          )}
        </div>
        {savedAt && !dirty && <p className="w-full text-xs text-gray-400">Son kayıt {savedAt}</p>}
      </div>

      {/* Sekmeler */}
      <div className="flex flex-wrap items-center gap-1.5">
        <TabButton active={tab === "cover"} onClick={() => setTab("cover")}>
          Antet ve Kapak
        </TabButton>
        {content.sheets.map((s, i) => (
          <TabButton key={i} active={tab === i} onClick={() => setTab(i)} muted={!s.includeInSummary}>
            {s.name}
          </TabButton>
        ))}
        {canEdit && (
          <button
            onClick={() => {
              update((c) => c.sheets.push(emptySheet(`Sayfa ${c.sheets.length + 1}`)));
              setTab(content.sheets.length);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:border-brand-300 hover:text-brand-700"
          >
            <Plus size={14} /> Sayfa
          </button>
        )}
        <span className="ml-auto text-sm text-gray-500">
          Genel toplam: <span className="font-semibold text-gray-900">{formatCurrencyTRY(total)}</span>
        </span>
      </div>

      {tab === "cover" ? (
        <CoverTab
          content={content}
          update={update}
          ro={ro}
          kind={kind}
          customers={customers}
          customerId={customerId}
          pickCustomer={pickCustomer}
          onLogo={onLogo}
          openSheet={setTab}
        />
      ) : content.sheets[tab] ? (
        <SheetTab
          sheet={content.sheets[tab]}
          ro={ro}
          showCosts={canExportInternal}
          update={(fn) => updateSheet(tab, fn)}
          onDelete={async () => {
            if (!(await confirmDelete(`"${content.sheets[tab].name}" sayfası silinsin mi?`))) return;
            update((c) => c.sheets.splice(tab, 1));
            setTab("cover");
          }}
          onDuplicate={() => {
            update((c) => c.sheets.splice(tab + 1, 0, { ...structuredClone(c.sheets[tab]), name: `${c.sheets[tab].name.slice(0, 24)} kopya` }));
            setTab(tab + 1);
          }}
          onMove={(dir) => {
            const j = tab + dir;
            if (j < 0 || j >= content.sheets.length) return;
            update((c) => ([c.sheets[tab], c.sheets[j]] = [c.sheets[j], c.sheets[tab]]));
            setTab(j);
          }}
        />
      ) : null}
    </div>
  );
}

function TabButton({ active, muted, onClick, children }: { active: boolean; muted?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`max-w-[200px] truncate rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active ? "bg-brand-800 text-white shadow-theme-xs" : muted ? "border border-gray-200 bg-white text-gray-400 hover:text-gray-700" : "border border-gray-200 bg-white text-gray-700 hover:border-brand-300"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, value, onChange, ro, area, placeholder }: { label: string; value: string; onChange: (v: string) => void; ro: boolean; area?: number; placeholder?: string }) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      {area ? (
        <textarea disabled={ro} rows={area} value={value} onChange={(e) => onChange(e.target.value)} className={INPUT} placeholder={placeholder} />
      ) : (
        <input disabled={ro} value={value} onChange={(e) => onChange(e.target.value)} className={INPUT} placeholder={placeholder} />
      )}
    </div>
  );
}

function CoverTab({
  content,
  update,
  ro,
  kind,
  customers,
  customerId,
  pickCustomer,
  onLogo,
  openSheet,
}: {
  content: WorkbookContent;
  update: (fn: (c: WorkbookContent) => void) => void;
  ro: boolean;
  kind: "TEMPLATE" | "QUOTE";
  customers: EditorProps["customers"];
  customerId: string;
  pickCustomer: (id: string) => void;
  onLogo: (f: File) => void;
  openSheet: (i: number) => void;
}) {
  const b = content.branding;
  const cv = content.cover;
  const cu = content.customer;
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className={CARD}>
        <h3 className="mb-3 text-[15px] font-semibold text-gray-900">Antet (logo ve firma bilgileri)</h3>
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-20 w-44 items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-300 bg-gray-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {b.logoDataUrl ? <img src={b.logoDataUrl} alt="Logo" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-gray-400">Logo yok</span>}
          </div>
          {!ro && (
            <div className="flex flex-col gap-1.5">
              <label className="cursor-pointer rounded-lg border border-gray-300 px-3 py-1.5 text-center text-sm text-gray-700 hover:bg-gray-50">
                Logo yükle
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onLogo(e.target.files[0])} />
              </label>
              {b.logoDataUrl && (
                <button onClick={() => update((c) => (c.branding.logoDataUrl = ""))} className="text-xs text-red-600 hover:underline">
                  Logoyu kaldır
                </button>
              )}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Firma unvanı" value={b.companyTitle} ro={ro} onChange={(v) => update((c) => (c.branding.companyTitle = v))} />
          </div>
          <div className="sm:col-span-2">
            <Field label="Adres" value={b.address} ro={ro} onChange={(v) => update((c) => (c.branding.address = v))} />
          </div>
          <Field label="Telefon" value={b.phone} ro={ro} onChange={(v) => update((c) => (c.branding.phone = v))} />
          <Field label="GSM" value={b.gsm} ro={ro} onChange={(v) => update((c) => (c.branding.gsm = v))} />
          <Field label="E-posta" value={b.email} ro={ro} onChange={(v) => update((c) => (c.branding.email = v))} />
          <Field label="Web" value={b.web} ro={ro} onChange={(v) => update((c) => (c.branding.web = v))} />
          <div className="sm:col-span-2">
            <Field label="Vergi dairesi / no" value={b.taxInfo} ro={ro} onChange={(v) => update((c) => (c.branding.taxInfo = v))} />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {kind === "QUOTE" && (
          <div className={CARD}>
            <h3 className="mb-3 text-[15px] font-semibold text-gray-900">Müşteri</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={LABEL}>Kayıtlı müşteri</label>
                <select disabled={ro} value={customerId} onChange={(e) => pickCustomer(e.target.value)} className={INPUT}>
                  <option value="">—</option>
                  {customers?.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.title}
                    </option>
                  ))}
                </select>
              </div>
              <Field label="Ad-Soyad / Unvan" value={cu.name} ro={ro} onChange={(v) => update((c) => (c.customer.name = v))} />
              <Field label="Teklif No" value={cu.quoteNo} ro={ro} onChange={(v) => update((c) => (c.customer.quoteNo = v))} placeholder="Dönüştürünce otomatik" />
              <div className="sm:col-span-2">
                <Field label="Adres" value={cu.address} ro={ro} onChange={(v) => update((c) => (c.customer.address = v))} />
              </div>
              <Field label="Telefon" value={cu.phone} ro={ro} onChange={(v) => update((c) => (c.customer.phone = v))} />
              <Field label="E-posta" value={cu.email} ro={ro} onChange={(v) => update((c) => (c.customer.email = v))} />
              <Field label="Tarih" value={cu.date} ro={ro} onChange={(v) => update((c) => (c.customer.date = v))} placeholder="gg.aa.yyyy" />
            </div>
          </div>
        )}

        <div className={CARD}>
          <h3 className="mb-3 text-[15px] font-semibold text-gray-900">Kapak yazısı</h3>
          <div className="space-y-3">
            <Field label='Hitap ("{musteri}" müşteri adıyla değişir)' value={cv.greeting} ro={ro} onChange={(v) => update((c) => (c.cover.greeting = v))} />
            <Field label="Giriş metni" area={4} value={cv.intro} ro={ro} onChange={(v) => update((c) => (c.cover.intro = v))} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Kapanış" value={cv.closing} ro={ro} onChange={(v) => update((c) => (c.cover.closing = v))} />
              <Field label="İmza (ad)" value={cv.signatureName} ro={ro} onChange={(v) => update((c) => (c.cover.signatureName = v))} />
              <Field label="İmza (unvan/firma)" value={cv.signatureTitle} ro={ro} onChange={(v) => update((c) => (c.cover.signatureTitle = v))} />
            </div>
            <Field
              label="Notlar (her satır bir madde)"
              area={6}
              value={cv.notes.join("\n")}
              ro={ro}
              onChange={(v) => update((c) => (c.cover.notes = v.split("\n").map((x) => x.trim()).filter(Boolean)))}
            />
          </div>
        </div>
      </div>

      <div className={`${CARD} xl:col-span-2`}>
        <h3 className="mb-3 text-[15px] font-semibold text-gray-900">Genel İcmal (kapak sayfasında)</h3>
        {content.sheets.length === 0 ? (
          <p className="text-sm text-gray-400">Henüz sayfa yok. &quot;Excel&apos;den içe aktar&quot; ile mevcut teklif dosyanızı yükleyin ya da &quot;+ Sayfa&quot; ekleyin.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="text-left text-theme-xs text-gray-500">
              <tr>
                <th className="py-2 pr-3">İcmalde</th>
                <th className="py-2 pr-3">Sayfa</th>
                <th className="py-2 pr-3">İcmal etiketi</th>
                <th className="py-2 text-right">Satış toplamı</th>
              </tr>
            </thead>
            <tbody>
              {content.sheets.map((s, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="py-2 pr-3">
                    <input type="checkbox" disabled={ro} checked={s.includeInSummary} onChange={(e) => update((c) => (c.sheets[i].includeInSummary = e.target.checked))} />
                  </td>
                  <td className="py-2 pr-3">
                    <button onClick={() => openSheet(i)} className="font-medium text-brand-700 hover:underline">
                      {s.name}
                    </button>
                  </td>
                  <td className="py-2 pr-3">
                    <input disabled={ro} value={s.summaryLabel} onChange={(e) => update((c) => (c.sheets[i].summaryLabel = e.target.value))} className={INPUT} />
                  </td>
                  <td className={`py-2 text-right font-medium ${s.includeInSummary ? "text-gray-900" : "text-gray-400 line-through"}`}>{formatCurrencyTRY(sheetTotals(s).total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SheetTab({
  sheet,
  ro,
  showCosts,
  update,
  onDelete,
  onDuplicate,
  onMove,
}: {
  sheet: TemplateSheet;
  ro: boolean;
  showCosts: boolean;
  update: (fn: (s: TemplateSheet) => void) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const t = sheetTotals(sheet);
  const p = sheet.pricing;
  const cur = p.currency === "TRY" ? "₺" : p.currency === "EUR" ? "€" : "$";
  const fmt = (n: number) => `${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
  const numField = (label: string, value: number, set: (n: number) => void, hint?: string) => (
    <div>
      <label className={LABEL} title={hint}>
        {label}
      </label>
      <input disabled={ro} inputMode="decimal" defaultValue={numStr(value)} key={`${label}-${value}`} onBlur={(e) => set(toNum(e.target.value) ?? 0)} className={INPUT} />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className={CARD}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <label className={LABEL}>Sekme adı</label>
            <input disabled={ro} maxLength={31} value={sheet.name} onChange={(e) => update((s) => (s.name = e.target.value || "Sayfa"))} className={INPUT} />
          </div>
          <div className="min-w-[260px] flex-1">
            <label className={LABEL}>Başlık</label>
            <input disabled={ro} value={sheet.title} onChange={(e) => update((s) => (s.title = e.target.value))} className={INPUT} />
          </div>
          {!ro && (
            <div className="flex gap-1">
              <IconBtn title="Sola taşı" onClick={() => onMove(-1)}>
                <ArrowUp size={14} className="-rotate-90" />
              </IconBtn>
              <IconBtn title="Sağa taşı" onClick={() => onMove(1)}>
                <ArrowDown size={14} className="-rotate-90" />
              </IconBtn>
              <IconBtn title="Sayfayı kopyala" onClick={onDuplicate}>
                <Copy size={14} />
              </IconBtn>
              <IconBtn title="Sayfayı sil" danger onClick={onDelete}>
                <Trash2 size={14} />
              </IconBtn>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className={`${CARD} xl:col-span-2`}>
          <h3 className="mb-3 text-[15px] font-semibold text-gray-900">Fiyatlandırma</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className={LABEL}>Malzeme para birimi</label>
              <select disabled={ro} value={p.currency} onChange={(e) => update((s) => (s.pricing.currency = e.target.value as TemplateSheet["pricing"]["currency"]))} className={INPUT}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            {numField("Kur (→ TL)", p.exchangeRate, (n) => update((s) => (s.pricing.exchangeRate = n)))}
            {numField("Liste iskontosu %", p.discountPct, (n) => update((s) => (s.pricing.discountPct = n)), "Net alış boşsa: liste × (1 − iskonto)")}
            {numField("Kâr çarpanı", p.profitMultiplier, (n) => update((s) => (s.pricing.profitMultiplier = n || 1)), "Örn. 1,35 = %35 kâr")}
            {numField("İşçilik (₺)", p.laborCost, (n) => update((s) => (s.pricing.laborCost = n)))}
            {numField("Ekstra gider (₺)", p.extraCost, (n) => update((s) => (s.pricing.extraCost = n)))}
            {numField("Genel gider (₺)", p.overheadCost, (n) => update((s) => (s.pricing.overheadCost = n)), "Kârdan sonra eklenir")}
          </div>
        </div>
        <div className={`${CARD} bg-gradient-to-br from-brand-50 to-white`}>
          <h3 className="mb-2 text-[15px] font-semibold text-gray-900">Sayfa toplamı</h3>
          <dl className="space-y-1 text-sm">
            {showCosts && (
              <>
                <Row k={`Malzeme (${p.currency})`} v={fmt(t.materials)} />
                {p.currency !== "TRY" && <Row k="Malzeme (₺)" v={formatCurrencyTRY(t.materialsTRY)} />}
                <Row k="Maliyet" v={formatCurrencyTRY(t.cost)} />
                <Row k="Kâr" v={formatCurrencyTRY(t.profit)} />
              </>
            )}
            <div className="mt-2 border-t border-brand-100 pt-2">
              <Row k="SATIŞ (KDV hariç)" v={formatCurrencyTRY(t.total)} bold />
            </div>
          </dl>
          <label className="mt-3 flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" disabled={ro} checked={sheet.includeInSummary} onChange={(e) => update((s) => (s.includeInSummary = e.target.checked))} />
            Kapaktaki Genel İcmal&apos;e dahil
          </label>
        </div>
      </div>

      <div className={CARD}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-gray-900">Teknik özellikler</h3>
          {!ro && (
            <button onClick={() => update((s) => s.specs.push({ label: "", value: "" }))} className="text-sm text-brand-700 hover:underline">
              + Özellik
            </button>
          )}
        </div>
        {sheet.specs.length === 0 && <p className="text-sm text-gray-400">Özellik yok (örn. EN, BOY, HAVUZ HACMİ, FİLTRE…).</p>}
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {sheet.specs.map((sp, i) => (
            <div key={i} className="flex gap-2">
              <input disabled={ro} value={sp.label} onChange={(e) => update((s) => (s.specs[i].label = e.target.value))} className={`${INPUT} w-2/5 font-medium`} placeholder="Özellik" />
              <input disabled={ro} value={sp.value} onChange={(e) => update((s) => (s.specs[i].value = e.target.value))} className={INPUT} placeholder="Değer" />
              {!ro && (
                <IconBtn title="Sil" danger onClick={() => update((s) => s.specs.splice(i, 1))}>
                  <X size={14} />
                </IconBtn>
              )}
            </div>
          ))}
        </div>
      </div>

      {sheet.groups.map((g, gi) => (
        <GroupCard key={gi} group={g} gi={gi} ro={ro} showCosts={showCosts} discountPct={p.discountPct} cur={cur} update={update} />
      ))}
      {!ro && (
        <button onClick={() => update((s) => s.groups.push({ title: `${s.groups.length + 1}- `, items: [emptyItem()], saleBasis: "cost", listDiscountPct: 0 }))} className="w-full rounded-2xl border border-dashed border-gray-300 py-3 text-sm text-gray-600 hover:border-brand-300 hover:text-brand-700">
          + Grup ekle (örn. &quot;1-FİLTRASYON SİSTEMİ MALZEMELERİ&quot;)
        </button>
      )}

      <div className={CARD}>
        <label className={LABEL}>Dipnotlar / açıklamalar (her satır bir madde — dahil olanlar, müşterinin yapması gerekenler vb.)</label>
        <textarea
          disabled={ro}
          rows={5}
          value={sheet.footnotes.join("\n")}
          onChange={(e) => update((s) => (s.footnotes = e.target.value.split("\n").filter((x) => x.trim())))}
          className={INPUT}
        />
      </div>
    </div>
  );
}

function GroupCard({
  group,
  gi,
  ro,
  showCosts,
  discountPct,
  cur,
  update,
}: {
  group: TemplateGroup;
  gi: number;
  ro: boolean;
  showCosts: boolean;
  discountPct: number;
  cur: string;
  update: (fn: (s: TemplateSheet) => void) => void;
}) {
  const ug = (fn: (g: TemplateGroup) => void) => update((s) => fn(s.groups[gi]));
  const groupTotal = group.items.reduce((s, it) => s + itemLineCost(it, discountPct), 0);
  const move = (ii: number, dir: -1 | 1) =>
    ug((g) => {
      const j = ii + dir;
      if (j < 0 || j >= g.items.length) return;
      [g.items[ii], g.items[j]] = [g.items[j], g.items[ii]];
    });

  return (
    <div className={`${CARD} p-0`}>
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
        <input disabled={ro} value={group.title} onChange={(e) => ug((g) => (g.title = e.target.value))} className={`${INPUT} font-semibold text-brand-900`} placeholder="Grup başlığı" />
        {showCosts && (
          <>
            <select
              disabled={ro}
              value={group.saleBasis}
              onChange={(e) => ug((g) => (g.saleBasis = e.target.value as TemplateGroup["saleBasis"]))}
              className="shrink-0 rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-700"
              title="Bu grubun müşteriye satış fiyatı nasıl hesaplanır"
            >
              <option value="cost">Satış: maliyet × kâr</option>
              <option value="list">Satış: liste − iskonto</option>
            </select>
            {group.saleBasis === "list" && (
              <label className="flex shrink-0 items-center gap-1 text-xs text-gray-500">
                %
                <input
                  disabled={ro}
                  type="number"
                  value={group.listDiscountPct}
                  onChange={(e) => ug((g) => (g.listDiscountPct = Number(e.target.value) || 0))}
                  className="w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-right text-xs"
                />
              </label>
            )}
            <span className="shrink-0 text-sm text-gray-500" title="Net alış toplamı (maliyet)">
              {groupTotal.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} {cur}
            </span>
          </>
        )}
        {!ro && (
          <IconBtn title="Grubu sil" danger onClick={() => update((s) => s.groups.splice(gi, 1))}>
            <Trash2 size={14} />
          </IconBtn>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-theme-xs text-gray-500">
            <tr>
              <th className="w-28 px-2 py-2">Boyut/Marka</th>
              <th className="min-w-[260px] px-2 py-2">Malzemenin cinsi</th>
              <th className="w-20 px-2 py-2 text-right">Miktar</th>
              <th className="w-20 px-2 py-2">Birim</th>
              {showCosts && (
                <>
                  <th className="w-24 px-2 py-2 text-right">Liste</th>
                  <th className="w-24 px-2 py-2 text-right">Net alış</th>
                  <th className="w-28 px-2 py-2 text-right">Tutar</th>
                </>
              )}
              {!ro && <th className="w-24 px-2 py-2" />}
            </tr>
          </thead>
          <tbody>
            {group.items.map((it, ii) => {
              const ui = (fn: (x: TemplateItem) => void) => ug((g) => fn(g.items[ii]));
              if (it.isHeading)
                return (
                  <tr key={ii}>
                    <td className="px-2 py-1.5" />
                    <td className="px-2 py-1.5" colSpan={showCosts ? 6 : 3}>
                      <input disabled={ro} value={it.description} onChange={(e) => ui((x) => (x.description = e.target.value))} className={`${INPUT} font-semibold`} placeholder="Ara başlık" />
                    </td>
                    {!ro && <RowActions onUp={() => move(ii, -1)} onDown={() => move(ii, 1)} onDelete={() => ug((g) => g.items.splice(ii, 1))} />}
                  </tr>
                );
              return (
                <tr key={ii} className="align-top">
                  <td className="px-2 py-1.5">
                    <input disabled={ro} value={it.prefix} onChange={(e) => ui((x) => (x.prefix = e.target.value))} className={INPUT} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input disabled={ro} value={it.description} onChange={(e) => ui((x) => (x.description = e.target.value))} className={INPUT} />
                    {(it.notes.length > 0 || !ro) && (
                      <textarea
                        disabled={ro}
                        rows={Math.max(1, it.notes.length)}
                        value={it.notes.join("\n")}
                        onChange={(e) => ui((x) => (x.notes = e.target.value.split("\n")))}
                        onBlur={(e) => ui((x) => (x.notes = e.target.value.split("\n").map((n) => n.trim()).filter(Boolean)))}
                        placeholder="* Açıklama satırları (her satır bir not)"
                        className="mt-1 w-full resize-y rounded-md border border-dashed border-gray-200 bg-gray-50/60 px-2 py-1 text-xs italic text-gray-600 focus:border-brand-300 focus:outline-none"
                      />
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <NumInput ro={ro} value={it.quantity} onChange={(n) => ui((x) => (x.quantity = n))} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input disabled={ro} value={it.unit} onChange={(e) => ui((x) => (x.unit = e.target.value))} className={INPUT} />
                  </td>
                  {showCosts && (
                    <>
                      <td className="px-2 py-1.5">
                        <NumInput ro={ro} value={it.listPrice} onChange={(n) => ui((x) => (x.listPrice = n))} />
                      </td>
                      <td className="px-2 py-1.5">
                        <NumInput ro={ro} value={it.netPrice} onChange={(n) => ui((x) => (x.netPrice = n))} placeholder={it.listPrice != null && discountPct ? String(+(it.listPrice * (1 - discountPct / 100)).toFixed(2)) : ""} />
                      </td>
                      <td className="px-2 py-1.5 pt-3 text-right font-medium text-gray-900">{itemLineCost(it, discountPct).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}</td>
                    </>
                  )}
                  {!ro && <RowActions onUp={() => move(ii, -1)} onDown={() => move(ii, 1)} onDelete={() => ug((g) => g.items.splice(ii, 1))} />}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!ro && (
        <div className="flex gap-3 border-t border-gray-100 px-5 py-2.5 text-sm">
          <button onClick={() => ug((g) => g.items.push(emptyItem()))} className="text-brand-700 hover:underline">
            + Kalem
          </button>
          <button onClick={() => ug((g) => g.items.push(emptyItem(true)))} className="text-gray-600 hover:underline">
            + Ara başlık
          </button>
        </div>
      )}
    </div>
  );
}

function NumInput({ value, onChange, ro, placeholder }: { value: number | null; onChange: (n: number | null) => void; ro: boolean; placeholder?: string }) {
  return (
    <input
      disabled={ro}
      inputMode="decimal"
      key={String(value)}
      defaultValue={numStr(value)}
      placeholder={placeholder}
      onBlur={(e) => {
        const n = toNum(e.target.value);
        if (n !== value) onChange(n);
      }}
      className={`${INPUT} text-right`}
    />
  );
}

function RowActions({ onUp, onDown, onDelete }: { onUp: () => void; onDown: () => void; onDelete: () => void }) {
  return (
    <td className="px-2 py-1.5">
      <div className="flex gap-0.5">
        <IconBtn title="Yukarı" onClick={onUp}>
          <ArrowUp size={13} />
        </IconBtn>
        <IconBtn title="Aşağı" onClick={onDown}>
          <ArrowDown size={13} />
        </IconBtn>
        <IconBtn title="Sil" danger onClick={onDelete}>
          <X size={13} />
        </IconBtn>
      </div>
    </td>
  );
}

function IconBtn({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border ${danger ? "border-red-100 text-red-500 hover:bg-red-50" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
    >
      {children}
    </button>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className={bold ? "font-semibold text-gray-900" : "text-gray-500"}>{k}</dt>
      <dd className={bold ? "text-lg font-bold text-brand-800" : "font-medium text-gray-900"}>{v}</dd>
    </div>
  );
}
