import { z } from "zod";

/** §TAX — Vergi & SGK Takibi. GD-03'teki tekrarlayan gider deseniyle aynı (recurringRule). */
export const taxObligationInputSchema = z.object({
  type: z.enum(["KDV", "MUHTASAR", "GECICI_VERGI", "SGK_PRIMI", "GELIR_VERGISI_STOPAJI", "DIGER"]),
  period: z.string().trim().min(1, "Dönem zorunlu").max(20),
  dueDate: z.coerce.date(),
  amount: z.coerce.number().positive("Tutar 0'dan büyük olmalı"),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
  isRecurringTemplate: z.boolean().default(false),
  recurringRule: z.enum(["MONTHLY", "QUARTERLY"]).optional(),
});
export type TaxObligationInput = z.infer<typeof taxObligationInputSchema>;

export const listTaxObligationsQuerySchema = z.object({
  status: z.enum(["PENDING", "PAID"]).optional(),
  type: z.enum(["KDV", "MUHTASAR", "GECICI_VERGI", "SGK_PRIMI", "GELIR_VERGISI_STOPAJI", "DIGER"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const payTaxObligationInputSchema = z.object({
  paidAmount: z.coerce.number().positive("Tutar 0'dan büyük olmalı"),
  paidAt: z.coerce.date(),
  accountId: z.string().uuid().optional().nullable(),
});
export type PayTaxObligationInput = z.infer<typeof payTaxObligationInputSchema>;
