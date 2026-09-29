import { z } from "zod";

/**
 * Grid filtreleri için ortak tarih parametreleri. URL'deki "YYYY-MM-DD" Türkiye saatiyle (UTC+3)
 * yorumlanır; bitiş tarihi o GÜNÜN SONUNA kadar kapsayıcıdır — aksi hâlde sunucu (UTC) "30.09" için
 * 30 Eylül 00:00'ı alır ve o günün kayıtları filtreden düşerdi.
 */
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const dateFromParam = z.preprocess(
  (v) => (typeof v === "string" && DAY.test(v) ? new Date(`${v}T00:00:00+03:00`) : v === "" ? undefined : v),
  z.coerce.date().optional(),
);

export const dateToParam = z.preprocess(
  (v) => (typeof v === "string" && DAY.test(v) ? new Date(`${v}T23:59:59.999+03:00`) : v === "" ? undefined : v),
  z.coerce.date().optional(),
);

/** Prisma `where` parçası: alan için tarih aralığı (ikisi de boşsa filtre yok). */
export function dateRange(field: string, from?: Date, to?: Date): Record<string, unknown> {
  if (!from && !to) return {};
  return { [field]: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } };
}
