import { sheetSchema, workbookContentSchema, type TemplateItem, type TemplateSheet, type WorkbookContent } from "./types";

/**
 * Excel teklif dosyasından (çok sayfalı) şablon içeriği çıkarır. SheetJS'e BAĞLI DEĞİL: girdi her
 * sayfa için ham hücre ızgarasıdır (satır × sütun); tarayıcıda SheetJS ile okunup buraya verilir
 * (dosya sunucuya hiç gitmez). Sabit hücre adresi varsaymaz — başlık satırlarını TANIR:
 *
 * - "MALZEMENİN CİNSİ / MİKTAR / BİRİM / LİSTE FİYATI / NET ALIŞ / TUTAR" satırı → tablo sütunları
 * - "1-FİLTRASYON…" gibi, ardından başlık satırı gelen tek hücreli satır → grup
 * - "*" ile başlayan satır → bir önceki kalemin açıklaması (tablo dışında: sayfa dipnotu)
 * - KUR / KAR / İŞÇİLİK / EKSTRA GİDER / GENEL GİDER / İSKONTO (%n) → sayfa fiyat ayarları
 * - Tel / Gsm / E-mail / Web satırları → firma alt bilgisi (antet)
 * - "Sayın …" içeren sayfa → kapak (giriş metni, imza, notlar)
 */
export type Cell = string | number | boolean | Date | null | undefined;
export interface RawSheet {
  name: string;
  rows: Cell[][];
}
export interface ParseResult {
  content: WorkbookContent;
  warnings: string[];
}

interface C {
  c: number;
  v: string | number;
  t: string; // normalize metin (büyük harf, tek boşluk)
}

const up = (s: string) => s.toLocaleUpperCase("tr").replace(/\s+/g, " ").trim();

function cellsOf(row: Cell[] | undefined): C[] {
  const out: C[] = [];
  (row ?? []).forEach((raw, c) => {
    if (raw == null || raw === "" || typeof raw === "boolean") return;
    if (raw instanceof Date) {
      out.push({ c, v: raw.toLocaleDateString("tr-TR"), t: raw.toLocaleDateString("tr-TR") });
      return;
    }
    if (typeof raw === "number") {
      if (Number.isFinite(raw)) out.push({ c, v: raw, t: String(raw) });
      return;
    }
    const s = String(raw).replace(/\s+/g, " ").trim();
    if (!s || s === ":") return;
    out.push({ c, v: s, t: up(s) });
  });
  return out;
}

const isNum = (x: C | undefined) => !!x && typeof x.v === "number";
const textCells = (cs: C[]) => cs.filter((x) => typeof x.v === "string");
const round = (n: number) => Math.round(n * 1e6) / 1e6;

const FOOTER_LABEL = /^(TEL|GSM|E-?MAİL|E-?MAIL|WEB|FAKS|FAX)$/;
const TOTAL_LIKE = /TOPLAM|İSKONTO|ISKONTO|^KUR$|^KAR$|^KÂR$|EKSTRA GİDER|GENEL GİDER|ŞEHİR DIŞI|SERAMİK NAK|^İŞÇİLİK$/;

function isFooterRow(cs: C[]) {
  return cs.some((x) => typeof x.v === "string" && FOOTER_LABEL.test(x.t));
}

interface ColMap {
  qty: number;
  desc?: number;
  unit?: number;
  list?: number;
  net?: number;
  prefix?: number;
}

function headerMap(cs: C[]): ColMap | null {
  const find = (re: RegExp) => cs.find((x) => typeof x.v === "string" && re.test(x.t))?.c;
  const qty = find(/^MİKTAR|^MIKTAR|^ADET$/);
  if (qty == null) return null;
  const hasDesc = find(/MALZEME|CİNSİ|AÇIKLAMA|ÜRÜN/) != null;
  const unit = find(/^BİRİM$|^BIRIM$/);
  const list = find(/LİSTE FİYAT|^FİYAT$|^BİRİM FİYAT/);
  if (!hasDesc && unit == null && list == null) return null;
  return {
    qty,
    desc: find(/MALZEME|CİNSİ|AÇIKLAMA|ÜRÜN/),
    unit,
    list,
    net: find(/NET ALIŞ|NET ALIS|NET FİYAT/),
    prefix: find(/^BOYUT$|^MARKA$/),
  };
}

function numAt(cs: C[], col: number | undefined): number | null {
  if (col == null) return null;
  const x = cs.find((y) => y.c === col);
  return isNum(x) ? (x!.v as number) : null;
}

/** Bir hücrenin sağındaki ilk sayı (aynı satırda) — "KUR ¦ 54", "SARE GENEL GİDER ¦ ¦ 25000". */
function numRightOf(cs: C[], col: number): number | null {
  const x = cs.filter((y) => y.c > col && isNum(y)).sort((a, b) => a.c - b.c)[0];
  return x ? (x.v as number) : null;
}

function applyPricing(cs: C[], sheet: TemplateSheet): boolean {
  let used = false;
  for (const x of textCells(cs)) {
    const n = numRightOf(cs, x.c);
    const pct = /İSKONTO|ISKONTO/.test(x.t) ? x.t.match(/%\s*(\d+(?:[.,]\d+)?)/) : null;
    if (pct) {
      sheet.pricing.discountPct = Number(pct[1].replace(",", "."));
      used = true;
      continue;
    }
    if (n == null) continue;
    if (/^KUR$/.test(x.t)) (sheet.pricing.exchangeRate = n), (used = true);
    else if (/^KA[RR]$|^KÂR$/.test(x.t) && n > 0.5 && n < 10) (sheet.pricing.profitMultiplier = n), (used = true);
    else if (/^İŞÇİLİK$/.test(x.t)) (sheet.pricing.laborCost += n), (used = true);
    else if (/EKSTRA GİDER|SERAMİK NAK/.test(x.t)) (sheet.pricing.extraCost += n), (used = true);
    else if (/GENEL GİDER|ŞEHİR DIŞI/.test(x.t)) (sheet.pricing.overheadCost += n), (used = true);
  }
  return used;
}

function nextNonEmpty(rows: Cell[][], i: number): C[] | null {
  for (let j = i + 1; j < Math.min(rows.length, i + 6); j++) {
    const cs = cellsOf(rows[j]);
    if (cs.length) return cs;
  }
  return null;
}

function collectFooter(cs: C[], content: WorkbookContent, footerLines: string[]) {
  const b = content.branding;
  const first = cs[0];
  if (first && typeof first.v === "string" && !FOOTER_LABEL.test(first.t)) footerLines.push(first.v);
  for (const x of cs) {
    if (typeof x.v !== "string" || !FOOTER_LABEL.test(x.t)) continue;
    const val = cs.find((y) => y.c > x.c);
    const s = val ? String(val.v).replace(/^\s*:\s*/, "").trim() : "";
    if (!s) continue;
    if (/^TEL$/.test(x.t) && !b.phone) b.phone = s;
    else if (/^GSM$/.test(x.t) && !b.gsm) b.gsm = s;
    else if (/MA[İI]L/.test(x.t) && !b.email) b.email = s;
    else if (/^WEB$/.test(x.t) && !b.web) b.web = s;
  }
}

function parseCover(rows: Cell[][], content: WorkbookContent, footerLines: string[]) {
  const cv = content.cover;
  let mode: "head" | "afterClosing" | "notes" = "head";
  let signature = 0;
  for (let i = 0; i < rows.length; i++) {
    const cs = cellsOf(rows[i]);
    if (!cs.length) continue;
    if (isFooterRow(cs)) {
      collectFooter(cs, content, footerLines);
      continue;
    }
    const texts = textCells(cs);
    const t0 = texts[0];
    if (!t0) continue;
    const s = String(t0.v);
    if (/^SAYIN/.test(t0.t)) {
      cv.greeting = "Sayın {musteri},";
      continue;
    }
    if (/^(AD-?SOYAD|ADRES|TEL|E-?MA[İI]L|TAR[İI]H|TEKL[İI]F NO)$/.test(t0.t)) continue;
    if (/^SAYGILARIMLA/.test(t0.t)) {
      cv.closing = s;
      mode = "afterClosing";
      continue;
    }
    if (/^NOTLAR/.test(t0.t)) {
      mode = "notes";
      continue;
    }
    if (/GENEL İCMAL|FİYAT TOPLAMI|GENEL TOPLAM/.test(t0.t)) continue;
    if (mode === "afterClosing" && texts.length === 1 && s.length <= 60) {
      if (signature === 0) cv.signatureName = s;
      else if (signature === 1) cv.signatureTitle = s;
      signature++;
      continue;
    }
    if (mode === "notes") {
      const note = s.replace(/^\*\s*/, "");
      if (/^\(/.test(s) && cv.notes.length) cv.notes[cv.notes.length - 1] += " " + s;
      else cv.notes.push(note);
      continue;
    }
    if (s.length > 60 && !cv.intro) cv.intro = s;
  }
}

function parseSheet(raw: RawSheet, content: WorkbookContent, footerLines: string[], warnings: string[]): TemplateSheet {
  const sheet = sheetSchema.parse({ name: raw.name.trim().slice(0, 31) || "Sayfa" });
  let map: ColMap | null = null;
  let prevMap: ColMap | null = null;
  let group: { title: string; items: TemplateItem[] } | null = null;
  let lastItem: TemplateItem | null = null;
  let seenTable = false;

  const pushGroup = (title: string) => {
    if (group && group.items.length === 0) {
      group.title = title; // boş grup başlığını (örn. bölüm başlığı) yenisiyle değiştir
      return;
    }
    group = { title, items: [] };
    sheet.groups.push(group);
    lastItem = null;
  };

  for (let i = 0; i < raw.rows.length; i++) {
    const cs = cellsOf(raw.rows[i]);
    if (!cs.length) continue;

    if (isFooterRow(cs)) {
      collectFooter(cs, content, footerLines);
      applyPricing(cs, sheet); // aynı satırda "SARE GENEL GİDER 25000" olabilir
      map = null;
      continue;
    }

    const hm = headerMap(cs);
    if (hm) {
      // Sonraki gruplarda başlık satırı çoğu zaman yalnızca "MALZEME / MİKTAR / BİRİM" yazar;
      // fiyat sütunları aynı yerde durur → yazılmayan sütunlar önceki başlıktan devralınır.
      map = prevMap ? { ...hm, list: hm.list ?? prevMap.list, net: hm.net ?? prevMap.net, unit: hm.unit ?? prevMap.unit } : hm;
      prevMap = map;
      seenTable = true;
      if (!group) pushGroup("");
      continue;
    }

    const texts = textCells(cs);
    const firstText = texts[0];

    // Fiyat ayarı / toplam satırları (kalem değil)
    const qtyHere = map ? numAt(cs, map.qty) : null;
    if (texts.some((x) => TOTAL_LIKE.test(x.t)) && qtyHere == null) {
      applyPricing(cs, sheet);
      continue;
    }

    // Grup başlığı: tek metin hücreli satır + hemen ardından tablo başlığı
    const next = nextNonEmpty(raw.rows, i);
    if (texts.length === 1 && cs.length === 1 && next && headerMap(next)) {
      pushGroup(firstText!.v as string);
      continue;
    }

    if (map) {
      const qty = qtyHere;
      const list = numAt(cs, map.list);
      const net = numAt(cs, map.net);
      // Açıklama: tablo başlığındaki açıklama/önek sütunundan miktar sütununa kadar olan metinler;
      // açıklama sütunu yoksa (örn. iç hesap tabloları) yalnızca miktarın hemen solundaki metin.
      const from = Math.min(map.desc ?? Infinity, map.prefix ?? Infinity);
      const leftAll = texts.filter((x) => x.c < map!.qty);
      const left = Number.isFinite(from) ? leftAll.filter((x) => x.c >= from) : leftAll.slice(-1);
      if (qty != null || ((list != null || net != null) && left.length)) {
        const prefixCell = map.prefix != null && left.length > 1 ? left.find((x) => x.c === map!.prefix) : undefined;
        const desc = left.filter((x) => x !== prefixCell).map((x) => x.v).join(" ");
        const unitCell = map.unit != null ? cs.find((x) => x.c === map!.unit && typeof x.v === "string") : undefined;
        const item: TemplateItem = {
          prefix: prefixCell ? String(prefixCell.v) : "",
          description: desc.replace(/^\*\s*/, "• "),
          notes: [],
          isHeading: false,
          quantity: qty,
          unit: unitCell ? String(unitCell.v) : "",
          listPrice: list != null ? round(list) : null,
          netPrice: net != null ? round(net) : null,
        };
        if (!group) pushGroup("");
        group!.items.push(item);
        lastItem = item;
        continue;
      }
      if (texts.length && !cs.some(isNum)) {
        const s = texts.map((x) => x.v).join(" ");
        if (/^\*/.test(s) && lastItem) {
          lastItem.notes.push(s.replace(/^\*\s*/, ""));
        } else if (s === up(s) && s.length <= 70) {
          if (!group) pushGroup("");
          const heading: TemplateItem = { prefix: "", description: s, notes: [], isHeading: true, quantity: null, unit: "", listPrice: null, netPrice: null };
          group!.items.push(heading);
          lastItem = null;
        } else if (lastItem) {
          lastItem.notes.push(s);
        } else {
          sheet.footnotes.push(s);
        }
        continue;
      }
    }

    // Tablo öncesi / dışı alan: başlık, teknik özellikler, dipnotlar
    if (!sheet.title && texts.length === 1 && cs.length === 1 && String(firstText!.v).length <= 120) {
      sheet.title = String(firstText!.v);
      continue;
    }
    if (texts.length === 1 && cs.length === 1) {
      const s = String(firstText!.v);
      if (s.length > 60 || /^\*/.test(s) || seenTable) {
        sheet.footnotes.push(s.replace(/^\*\s*/, "• "));
      } else {
        sheet.specs.push({ label: s.replace(/:\s*$/, ""), value: "" });
      }
      continue;
    }
    // "EN (M) ¦ BOY(M) ¦ h:(M)" + bir sonraki satırda sayılar → çiftler
    if (texts.length === cs.length && cs.length >= 2 && next && next.length === cs.length && next.every(isNum)) {
      cs.forEach((x, k) => sheet.specs.push({ label: String(x.v), value: String(next[k].v) }));
      i++; // değer satırını atla
      continue;
    }
    if (firstText && cs[0] === firstText) {
      const rest = cs.slice(1).map((x) => (typeof x.v === "number" ? String(round(x.v)).replace(".", ",") : x.v));
      const label = String(firstText.v).replace(/:\s*$/, "");
      if (label.length > 80) sheet.footnotes.push(String(firstText.v));
      else sheet.specs.push({ label, value: rest.join(" · ") });
      continue;
    }
  }

  sheet.groups = sheet.groups.filter((g) => g.items.length > 0 || g.title);
  if (sheet.pricing.exchangeRate !== 1 && sheet.pricing.exchangeRate > 0) sheet.pricing.currency = "EUR";
  if (!sheet.title) sheet.title = sheet.name;
  sheet.summaryLabel = sheet.title;
  // İç hesap/opsiyonel sayfalar kapak icmaline varsayılan olarak girmesin.
  sheet.includeInSummary = !/HESAP|OPSİYONEL|OPSIYONEL/.test(up(sheet.name));
  if (sheet.groups.length === 0 && sheet.specs.length === 0 && sheet.footnotes.length === 0) {
    warnings.push(`"${raw.name}" sayfasında içerik bulunamadı.`);
  }
  return sheet;
}

export function parseWorkbook(rawSheets: RawSheet[]): ParseResult {
  const content = workbookContentSchema.parse({});
  const warnings: string[] = [];
  const footerLines: string[] = [];

  for (const raw of rawSheets) {
    const isCover = raw.rows.some((r) => cellsOf(r).some((x) => typeof x.v === "string" && /^SAYIN/.test(x.t)));
    if (isCover) parseCover(raw.rows, content, footerLines);
    else content.sheets.push(parseSheet(raw, content, footerLines, warnings));
  }

  // Firma alt bilgisi: ilk 2 satır unvan, sonrakiler adres (sayfalarda tekrar ettiği için ilk görülenler).
  const uniq = Array.from(new Set(footerLines));
  if (uniq.length) {
    content.branding.companyTitle = uniq.slice(0, 2).join(" ");
    content.branding.address = uniq.slice(2, 4).join(", ");
  }
  if (!content.cover.greeting) content.cover.greeting = "Sayın {musteri},";
  return { content: workbookContentSchema.parse(content), warnings };
}
