import { z } from "zod";

/** Teklif ve Sipariş satırları AYNI yapıyı paylaşır (§5.6 SP-03) — tek şema, iki modülde de kullanılır. */

export const discountTypeSchema = z.enum(["PERCENT", "AMOUNT"]);

export const lineItemInputSchema = z.object({
  id: z.string().uuid().optional(),
  productId: z.string().uuid().optional().nullable(),
  description: z.string().trim().min(1, "Açıklama zorunlu").max(500),
  quantity: z.coerce.number().positive("Miktar 0'dan büyük olmalı"),
  unit: z.string().trim().min(1).max(50).default("adet"),
  unitPrice: z.coerce.number().min(0, "Birim fiyat negatif olamaz"),
  unitCost: z.coerce.number().min(0).optional().nullable(),
  discountType: discountTypeSchema.default("PERCENT"),
  discountValue: z.coerce.number().min(0).default(0),
  vatRate: z.coerce.number().min(0).max(100),
});

export type LineItemInput = z.infer<typeof lineItemInputSchema>;

export const documentDiscountSchema = z
  .object({
    type: discountTypeSchema,
    value: z.coerce.number().min(0),
  })
  .optional()
  .nullable();
