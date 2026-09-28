import { z } from "zod";

/** §SM-02 — Satın alma (tedarikçiden alım) satırları: teklif/sipariş satırından daha basit,
 *  iskonto yok, yalnızca miktar × birim maliyet + KDV. */
export const purchaseOrderItemInputSchema = z.object({
  productId: z.string().uuid().optional().nullable(),
  description: z.string().trim().min(1, "Açıklama zorunlu").max(300),
  quantity: z.coerce.number().positive("Miktar 0'dan büyük olmalı"),
  unitCost: z.coerce.number().min(0, "Birim maliyet negatif olamaz"),
  vatRate: z.coerce.number().min(0).max(100),
});
export type PurchaseOrderItemInput = z.infer<typeof purchaseOrderItemInputSchema>;

export const purchaseOrderInputSchema = z.object({
  supplierId: z.string().uuid("Tedarikçi seçin"),
  orderedAt: z.coerce.date(),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
  items: z.array(purchaseOrderItemInputSchema).min(1, "En az bir satır ekleyin"),
});
export type PurchaseOrderInput = z.infer<typeof purchaseOrderInputSchema>;

export const listPurchaseOrdersQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(["DRAFT", "RECEIVED", "CANCELLED"]).optional(),
  supplierId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const stockAdjustmentInputSchema = z.object({
  productId: z.string().uuid(),
  /** + stok ekler, - stok düşer (manuel sayım düzeltmesi). */
  quantity: z.coerce.number().refine((v) => v !== 0, "Miktar 0 olamaz"),
  note: z.string().trim().min(1, "Not zorunlu (düzeltme gerekçesi)").max(500),
});
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentInputSchema>;
