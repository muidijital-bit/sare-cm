import ExcelJS from "exceljs";
import type { TemplateSheet, WorkbookContent } from "./types";
import { itemNet, sheetTotals } from "./calc";

/**
 * Şablon/teklif belgesini çok sayfalı .xlsx olarak üretir (örnek Excel'in düzeni): kapak sayfası
 * (logo, antet, müşteri, giriş metni, imza, GENEL İCMAL, notlar) + her içerik sayfası.
 *
 * mode = "customer": maliyet/kâr/net alış GÖRÜNMEZ; kalemler miktar/birimle, sayfa sonunda satış toplamı.
 * mode = "internal": liste/net alış/tutar sütunları + kur, işçilik, kâr çarpanı, genel gider dökümü (formüllü).
 */
export type ExportMode = "customer" | "internal";

const BRAND = "FF1F2937"; // koyu gri — müşteri belgesinde nötr renk
const BRAND_SOFT = "FFF2F4F7";
const GRAY = "FF667085";
const BORDER = { style: "thin" as const, color: { argb: "FFE4E7EC" } };
const TL = '#,##0.00 "₺"';
const CUR: Record<string, string> = { TRY: TL, EUR: '#,##0.00 "€"', USD: '"$"#,##0.00' };

function addLogo(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, dataUrl: string, col: number, row: number, widthPx = 170) {
  const m = /^data:image\/(png|jpe?g|gif);base64,(.+)$/i.exec(dataUrl || "");
  if (!m) return;
  const ext = m[1].toLowerCase() === "jpg" ? "jpeg" : (m[1].toLowerCase() as "png" | "jpeg" | "gif");
  const id = wb.addImage({ base64: m[2], extension: ext });
  ws.addImage(id, { tl: { col, row }, ext: { width: widthPx, height: Math.round(widthPx * 0.42) } });
}

function pageSetup(ws: ExcelJS.Worksheet, content: WorkbookContent) {
  const b = content.branding;
  ws.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.2, footer: 0.25 } };
  const footer = [b.companyTitle, b.address, [b.phone && `Tel: ${b.phone}`, b.gsm && `Gsm: ${b.gsm}`, b.email, b.web].filter(Boolean).join("  ·  ")]
    .filter(Boolean)
    .join("\n")
    .replace(/&/g, "&&");
  ws.headerFooter = { oddFooter: `&8&K667085${footer}&R&8Sayfa &P / &N` };
}

function footerBlock(ws: ExcelJS.Worksheet, content: WorkbookContent, startRow: number, lastCol: number) {
  const b = content.branding;
  const lines = [b.companyTitle, b.address, [b.phone && `Tel: ${b.phone}`, b.gsm && `Gsm: ${b.gsm}`].filter(Boolean).join("   "), [b.email, b.web].filter(Boolean).join("   ")].filter(Boolean);
  let r = startRow + 1;
  ws.getRow(r).getCell(1).border = { top: { style: "medium", color: { argb: BRAND } } };
  for (let c = 1; c <= lastCol; c++) ws.getRow(r).getCell(c).border = { top: { style: "medium", color: { argb: BRAND } } };
  for (const l of lines) {
    ws.mergeCells(r, 1, r, lastCol);
    const cell = ws.getCell(r, 1);
    cell.value = l;
    cell.font = { size: 8, color: { argb: GRAY } };
    cell.alignment = { horizontal: "center" };
    r++;
  }
  return r;
}

function buildCover(wb: ExcelJS.Workbook, content: WorkbookContent, mode: ExportMode) {
  const ws = wb.addWorksheet("BAŞLIK", { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 16 }, { width: 3 }, { width: 34 }, { width: 14 }, { width: 12 }, { width: 3 }, { width: 22 }];
  pageSetup(ws, content);
  const c = content.customer;
  const b = content.branding;

  addLogo(wb, ws, b.logoDataUrl, 0, 0);
  ws.mergeCells("D1:G3");
  const head = ws.getCell("D1");
  head.value = b.companyTitle;
  head.font = { bold: true, size: 11, color: { argb: "FF101828" } };
  head.alignment = { horizontal: "right", vertical: "middle", wrapText: true };

  const info: [string, string, string, string][] = [
    ["Ad-Soyad", c.name, "Tarih", c.date],
    ["Adres", c.address, "Teklif No", c.quoteNo],
    ["Tel", c.phone, "", ""],
    ["E-Mail", c.email, "", ""],
  ];
  info.forEach(([l1, v1, l2, v2], i) => {
    const r = 6 + i;
    ws.getCell(r, 1).value = l1;
    ws.getCell(r, 2).value = ":";
    ws.getCell(r, 3).value = v1;
    ws.getCell(r, 5).value = l2;
    if (l2) ws.getCell(r, 6).value = ":";
    ws.getCell(r, 7).value = v2;
    [1, 5].forEach((col) => (ws.getCell(r, col).font = { bold: true }));
    ws.getCell(r, 3).alignment = { wrapText: true, vertical: "top" };
  });

  let r = 11;
  ws.getCell(r, 1).value = (content.cover.greeting || "Sayın {musteri},").replace("{musteri}", c.name || "…");
  ws.getCell(r, 1).font = { bold: true };
  r += 1;
  ws.mergeCells(r, 1, r + 3, 7);
  const intro = ws.getCell(r, 1);
  intro.value = content.cover.intro;
  intro.alignment = { wrapText: true, vertical: "top" };
  r += 5;
  if (content.cover.closing) ws.getCell(r++, 1).value = content.cover.closing;
  if (content.cover.signatureName) ws.getCell(++r, 1).value = content.cover.signatureName;
  ws.getCell(r, 1).font = { bold: true };
  if (content.cover.signatureTitle) ws.getCell(++r, 1).value = content.cover.signatureTitle;
  r += 2;

  // GENEL İCMAL
  ws.mergeCells(r, 1, r, 7);
  const icmal = ws.getCell(r, 1);
  icmal.value = "GENEL İCMAL";
  icmal.font = { bold: true, color: { argb: "FFFFFFFF" } };
  icmal.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  icmal.alignment = { horizontal: "center" };
  r++;
  const firstSum = r;
  for (const s of content.sheets.filter((x) => x.includeInSummary)) {
    const t = sheetTotals(s);
    if (t.total <= 0) continue;
    ws.mergeCells(r, 1, r, 6);
    ws.getCell(r, 1).value = `${s.summaryLabel || s.title || s.name} FİYAT TOPLAMI:`;
    ws.getCell(r, 7).value = Math.round(t.total * 100) / 100;
    ws.getCell(r, 7).numFmt = TL;
    for (let col = 1; col <= 7; col++) ws.getCell(r, col).border = { bottom: BORDER };
    r++;
  }
  ws.mergeCells(r, 1, r, 6);
  ws.getCell(r, 1).value = "GENEL TOPLAM:";
  ws.getCell(r, 1).alignment = { horizontal: "right" };
  ws.getCell(r, 7).value = r > firstSum ? { formula: `SUM(G${firstSum}:G${r - 1})` } : 0;
  ws.getCell(r, 7).numFmt = TL;
  [1, 7].forEach((col) => {
    ws.getCell(r, col).font = { bold: true, size: 12 };
    ws.getCell(r, col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_SOFT } };
  });
  r += 2;

  if (content.cover.notes.length) {
    ws.getCell(r++, 1).value = "NOTLAR:";
    ws.getCell(r - 1, 1).font = { bold: true };
    for (const n of content.cover.notes) {
      ws.mergeCells(r, 1, r, 7);
      ws.getCell(r, 1).value = `• ${n}`;
      ws.getCell(r, 1).alignment = { wrapText: true, vertical: "top" };
      ws.getRow(r).height = Math.max(15, Math.ceil(n.length / 95) * 15);
      r++;
    }
  }
  if (mode === "internal") {
    r++;
    ws.getCell(r, 1).value = "İÇ KULLANIM — maliyet ve kâr bilgisi içerir, müşteriye göndermeyin.";
    ws.getCell(r, 1).font = { bold: true, color: { argb: "FFB42318" } };
  }
  footerBlock(ws, content, r + 1, 7);
}

function buildSheet(wb: ExcelJS.Workbook, content: WorkbookContent, s: TemplateSheet, mode: ExportMode, usedNames: Set<string>) {
  let name = s.name.replace(/[\\/?*[\]:]/g, "-").slice(0, 31) || "Sayfa";
  while (usedNames.has(name.toLocaleUpperCase("tr"))) name = `${name.slice(0, 28)}-${usedNames.size}`;
  usedNames.add(name.toLocaleUpperCase("tr"));

  const internal = mode === "internal";
  const ws = wb.addWorksheet(name, { views: [{ showGridLines: false }] });
  const cols = internal
    ? [{ width: 14 }, { width: 46 }, { width: 9 }, { width: 8 }, { width: 13 }, { width: 13 }, { width: 14 }]
    : [{ width: 14 }, { width: 56 }, { width: 10 }, { width: 9 }];
  ws.columns = cols;
  const last = cols.length;
  pageSetup(ws, content);
  const cur = CUR[s.pricing.currency] ?? TL;

  addLogo(wb, ws, content.branding.logoDataUrl, 0, 0, 130);
  let r = 4;
  ws.mergeCells(r, 1, r, last);
  const title = ws.getCell(r, 1);
  title.value = s.title || s.name;
  title.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  title.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(r).height = 22;
  r += 2;

  for (const sp of s.specs) {
    ws.getCell(r, 1).value = sp.label;
    ws.getCell(r, 1).font = { bold: true };
    ws.mergeCells(r, 2, r, last);
    ws.getCell(r, 2).value = sp.value;
    ws.getCell(r, 2).alignment = { wrapText: true };
    for (let c = 1; c <= last; c++) ws.getCell(r, c).border = { bottom: BORDER };
    r++;
  }
  if (s.specs.length) r++;

  const header = internal ? ["", "MALZEMENİN CİNSİ", "MİKTAR", "BİRİM", "LİSTE FİYATI", "NET ALIŞ", "TUTAR"] : ["", "MALZEMENİN CİNSİ", "MİKTAR", "BİRİM"];
  const totalCells: string[] = [];
  const listCostCells: string[] = [];
  const listSaleParts: string[] = [];
  for (const g of s.groups) {
    if (g.title) {
      ws.mergeCells(r, 1, r, last);
      ws.getCell(r, 1).value = g.title;
      ws.getCell(r, 1).font = { bold: true, color: { argb: "FF111827" } };
      ws.getCell(r, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_SOFT } };
      r++;
    }
    header.forEach((h, i) => {
      const cell = ws.getCell(r, i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 9, color: { argb: GRAY } };
      cell.border = { bottom: { style: "thin", color: { argb: "FF98A2B3" } } };
      cell.alignment = { horizontal: i >= 2 ? "right" : "left" };
    });
    r++;
    const first = r;
    for (const it of g.items) {
      // Miktarı 0 olan seçenekler (örn. "Seçim 2") müşteri sürümünde gösterilmez
      if (!internal && !it.isHeading && it.quantity === 0) continue;
      if (it.isHeading) {
        ws.mergeCells(r, 1, r, last);
        ws.getCell(r, 1).value = it.description;
        ws.getCell(r, 1).font = { bold: true, size: 9 };
        r++;
        continue;
      }
      ws.getCell(r, 1).value = it.prefix || null;
      ws.getCell(r, 2).value = it.description;
      ws.getCell(r, 2).alignment = { wrapText: true, vertical: "top" };
      ws.getCell(r, 3).value = it.quantity;
      ws.getCell(r, 4).value = it.unit;
      if (internal) {
        ws.getCell(r, 5).value = it.listPrice;
        ws.getCell(r, 6).value = itemNet(it, s.pricing.discountPct);
        ws.getCell(r, 7).value = it.quantity != null ? { formula: `IFERROR(C${r}*F${r},0)` } : null;
        [5, 6, 7].forEach((c) => (ws.getCell(r, c).numFmt = cur));
      }
      for (let c = 1; c <= last; c++) ws.getCell(r, c).border = { bottom: BORDER };
      r++;
      for (const n of it.notes) {
        ws.getCell(r, 2).value = `* ${n}`;
        ws.getCell(r, 2).font = { italic: true, size: 9, color: { argb: GRAY } };
        ws.getCell(r, 2).alignment = { wrapText: true };
        r++;
      }
    }
    if (internal && r > first) {
      ws.getCell(r, 6).value = "Grup toplamı";
      ws.getCell(r, 6).font = { size: 9, color: { argb: GRAY } };
      ws.getCell(r, 7).value = { formula: `SUM(G${first}:G${r - 1})` };
      ws.getCell(r, 7).numFmt = cur;
      ws.getCell(r, 7).font = { bold: true };
      totalCells.push(`G${r}`);
      if (g.saleBasis === "list") {
        listCostCells.push(`G${r}`);
        listSaleParts.push(`SUMPRODUCT(C${first}:C${r - 1},E${first}:E${r - 1})*${1 - (g.listDiscountPct || 0) / 100}`);
      }
      r++;
    }
    r++;
  }

  const t = sheetTotals(s);
  const p = s.pricing;
  const lab = (row: number, text: string) => {
    ws.mergeCells(row, 1, row, last - 1);
    const cell = ws.getCell(row, 1);
    cell.value = text;
    cell.alignment = { horizontal: "right" };
  };
  if (internal) {
    const rows: [string, ExcelJS.CellValue, string][] = [];
    const matRow = r;
    rows.push([`Malzeme toplamı (${p.currency})`, totalCells.length ? { formula: totalCells.join("+") } : 0, cur]);
    rows.push(["Kur", p.currency === "TRY" ? 1 : p.exchangeRate, "0.0000"]);
    rows.push(["Malzeme (TL)", { formula: `G${matRow}*G${matRow + 1}` }, TL]);
    rows.push(["İşçilik", p.laborCost, TL]);
    rows.push(["Ekstra gider", p.extraCost, TL]);
    rows.push(["MALİYET", { formula: `G${matRow + 2}+G${matRow + 3}+G${matRow + 4}` }, TL]);
    rows.push(["Kâr çarpanı", p.profitMultiplier, "0.00"]);
    rows.push(["Genel gider", p.overheadCost, TL]);
    if (listCostCells.length) {
      // Liste fiyatından satılan gruplar kâr çarpanının dışında: maliyetten düşülür, satışları eklenir
      rows.push(["Liste fiyatlı grupların maliyeti (TL)", { formula: `(${listCostCells.join("+")})*G${matRow + 1}` }, TL]);
      rows.push(["Liste fiyatlı grupların satışı (TL)", { formula: `(${listSaleParts.join("+")})*G${matRow + 1}` }, TL]);
      rows.push(["SATIŞ TOPLAMI (KDV hariç)", { formula: `(G${matRow + 5}-G${matRow + 8})*G${matRow + 6}+G${matRow + 9}+G${matRow + 7}` }, TL]);
    } else {
      rows.push(["SATIŞ TOPLAMI (KDV hariç)", { formula: `G${matRow + 5}*G${matRow + 6}+G${matRow + 7}` }, TL]);
    }
    rows.forEach(([l, v, fmt], i) => {
      lab(r, l);
      ws.getCell(r, last).value = v;
      ws.getCell(r, last).numFmt = fmt;
      if (i === 5 || i === rows.length - 1) [1, last].forEach((c) => (ws.getCell(r, c).font = { bold: true }));
      r++;
    });
    ws.getCell(r - 1, last).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_SOFT } };
  } else if (t.total > 0) {
    lab(r, "FİYAT TOPLAMI (KDV hariç)");
    ws.getCell(r, 1).font = { bold: true };
    ws.getCell(r, last).value = Math.round(t.total * 100) / 100;
    ws.getCell(r, last).numFmt = TL;
    ws.getCell(r, last).font = { bold: true, size: 12 };
    ws.getCell(r, last).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_SOFT } };
    r++;
  }

  if (s.footnotes.length) {
    r++;
    for (const f of s.footnotes) {
      ws.mergeCells(r, 1, r, last);
      ws.getCell(r, 1).value = f;
      ws.getCell(r, 1).alignment = { wrapText: true, vertical: "top" };
      ws.getCell(r, 1).font = { size: 9 };
      ws.getRow(r).height = Math.max(15, Math.ceil(f.length / 110) * 14);
      r++;
    }
  }
  footerBlock(ws, content, r + 1, last);
}

export async function buildWorkbookXlsx(content: WorkbookContent, mode: ExportMode): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "muiflow";
  wb.created = new Date();
  buildCover(wb, content, mode);
  const used = new Set<string>(["BAŞLIK"]);
  const sheets = mode === "customer" ? content.sheets.filter((s) => !/HESAP/i.test(s.name)) : content.sheets;
  for (const s of sheets) buildSheet(wb, content, s, mode, used);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
