import ExcelJS from "exceljs";

/**
 * Gerçek Excel (.xlsx) dışa aktarma — tüm gridler ortak kullanır (bkz. src/lib/export/registry.ts).
 * CSV yerine .xlsx: tutarlar SAYI olarak gider (Excel'de toplanabilir, ₺ biçimli), tarihler TARİH
 * olarak gider (sıralanabilir), başlık kalın/renkli, ilk satır dondurulmuş ve otomatik filtreli,
 * satırlar zebra, para sütunlarının altında toplam satırı.
 */
export type XlsxColumnType = "text" | "number" | "currency" | "date" | "percent";

export interface XlsxColumn<T> {
  header: string;
  type?: XlsxColumnType;
  /** Karakter cinsinden yaklaşık genişlik (verilmezse türüne göre). */
  width?: number;
  value: (row: T) => string | number | Date | null | undefined;
  /** Para/sayı sütununun altına toplam yazılsın mı (varsayılan: currency için evet). */
  total?: boolean;
}

const BRAND = "FF6D28D9";
const ZEBRA = "FFF8F5FF";
const BORDER = "FFE4E7EC";

const NUM_FMT: Record<XlsxColumnType, string | undefined> = {
  text: undefined,
  number: "#,##0.##",
  currency: '#,##0.00 "₺"',
  date: "dd.mm.yyyy",
  percent: '0.0"%"',
};
const DEFAULT_WIDTH: Record<XlsxColumnType, number> = { text: 24, number: 12, currency: 16, date: 12, percent: 10 };

export async function buildXlsx<T>(opts: { sheetName: string; title: string; rows: T[]; columns: XlsxColumn<T>[]; subtitle?: string }): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "muiflow";
  wb.created = new Date();
  const ws = wb.addWorksheet(opts.sheetName.slice(0, 31), { views: [{ state: "frozen", ySplit: 3 }] });

  // 1. satır: başlık, 2. satır: alt bilgi (filtre/tarih), 3. satır: sütun başlıkları
  ws.mergeCells(1, 1, 1, Math.max(1, opts.columns.length));
  const titleCell = ws.getCell(1, 1);
  titleCell.value = opts.title;
  titleCell.font = { bold: true, size: 14, color: { argb: "FF101828" } };
  ws.getRow(1).height = 22;
  ws.mergeCells(2, 1, 2, Math.max(1, opts.columns.length));
  const sub = ws.getCell(2, 1);
  sub.value = `${opts.subtitle ? opts.subtitle + " · " : ""}${opts.rows.length} kayıt · ${new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}`;
  sub.font = { size: 9, color: { argb: "FF667085" } };

  const header = ws.getRow(3);
  opts.columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    cell.alignment = { vertical: "middle", horizontal: c.type && c.type !== "text" && c.type !== "date" ? "right" : "left" };
    ws.getColumn(i + 1).width = c.width ?? DEFAULT_WIDTH[c.type ?? "text"];
  });
  header.height = 20;

  opts.rows.forEach((row, r) => {
    const excelRow = ws.getRow(4 + r);
    opts.columns.forEach((c, i) => {
      const cell = excelRow.getCell(i + 1);
      const raw = c.value(row);
      cell.value = raw === undefined || raw === "" ? null : raw;
      const fmt = NUM_FMT[c.type ?? "text"];
      if (fmt) cell.numFmt = fmt;
      if (r % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
      cell.border = { bottom: { style: "thin", color: { argb: BORDER } } };
    });
  });

  // Toplam satırı (para sütunları)
  const totalCols = opts.columns.map((c, i) => ({ c, i })).filter(({ c }) => c.total ?? c.type === "currency");
  if (opts.rows.length > 0 && totalCols.length > 0) {
    const tr = ws.getRow(4 + opts.rows.length);
    const firstText = opts.columns.findIndex((c) => !c.type || c.type === "text");
    tr.getCell((firstText >= 0 ? firstText : 0) + 1).value = "TOPLAM";
    for (const { c, i } of totalCols) {
      const col = ws.getColumn(i + 1).letter;
      const cell = tr.getCell(i + 1);
      cell.value = { formula: `SUBTOTAL(9,${col}4:${col}${3 + opts.rows.length})` };
      cell.numFmt = NUM_FMT[c.type ?? "number"] ?? NUM_FMT.number!;
    }
    tr.eachCell((cell) => {
      cell.font = { bold: true };
      cell.border = { top: { style: "medium", color: { argb: BRAND } } };
    });
  }

  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + opts.rows.length, column: opts.columns.length } };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

export function xlsxResponseHeaders(filename: string): HeadersInit {
  // RFC 5987: Türkçe karakterli dosya adı için filename* (eski tarayıcılar için ASCII yedek).
  const ascii = filename.normalize("NFD").replace(/[^\x20-\x7E]/g, "").replace(/"/g, "");
  return {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Cache-Control": "no-store",
  };
}
