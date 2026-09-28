import { z } from "zod";

/** Ürün kataloğu — teklif/sipariş/satın alma satırlarındaki ürün seçicisinin veri kaynağı. */
export const productInputSchema = z.object({
  code: z.string().trim().max(50).optional().or(z.literal("")),
  name: z.string().trim().min(1, "Ürün adı zorunlu").max(300),
  unit: z.string().trim().min(1, "Birim zorunlu").max(20).default("adet"),
  listPrice: z.coerce.number().min(0, "Liste fiyatı negatif olamaz"),
  defaultCost: z.coerce.number().min(0).optional().nullable(),
  vatRate: z.coerce.number().min(0).max(100),
  isActive: z.boolean().default(true),
});
export type ProductInput = z.infer<typeof productInputSchema>;

export const listProductsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
