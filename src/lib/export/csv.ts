/**
 * Basit CSV üretici — "Excel'e aktar" istekleri için. Gerçek bir .xlsx yerine CSV
 * kullanıyoruz: yeni bir binary bağımlılık gerektirmez, Excel'de çift tıklayınca doğrudan
 * açılır. UTF-8 BOM eklenir; aksi halde Excel Türkçe karakterleri (ş, ı, ğ, ü, ö, ç) bozuk
 * gösterir. Ayraç noktalı virgül (;) — Türkçe Excel'in varsayılan CSV ayracı budur (ondalık
 * ayırıcı virgül olduğu için standart "," ayraçla karışır).
 */
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

function escapeCsvCell(raw: string): string {
  if (/[";\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(";");
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const v = c.value(row);
        if (v === null || v === undefined) return "";
        return escapeCsvCell(String(v));
      })
      .join(";"),
  );
  return "﻿" + [header, ...lines].join("\r\n");
}

export function csvResponseHeaders(filename: string): HeadersInit {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
  };
}
