import { z } from "zod";

export const paymentMethodSchema = z.enum(["CASH", "BANK_TRANSFER", "CREDIT_CARD", "CHECK"]);

export const paymentAllocationInputSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.coerce.number().positive("Mahsup tutarı 0'dan büyük olmalı"),
});

export const paymentInputSchema = z
  .object({
    customerId: z.string().uuid("Müşteri seçin"),
    accountId: z.string().uuid("Kasa/banka hesabı seçin"),
    paidAt: z.coerce.date(),
    // TH-06: İade negatif tutarla temsil edilir.
    amount: z.coerce.number().refine((v) => v !== 0, "Tutar 0 olamaz"),
    method: paymentMethodSchema,
    reference: z.string().trim().max(200).optional().or(z.literal("")),
    note: z.string().trim().max(1000).optional().or(z.literal("")),
    allocations: z.array(paymentAllocationInputSchema).max(20).default([]),
  })
  .refine((data) => data.amount > 0 || (data.note && data.note.trim().length > 0), {
    message: "İade kaydında gerekçe (not alanı) zorunludur.",
    path: ["note"],
  })
  .refine((data) => data.amount > 0 || data.allocations.length === 0, {
    message: "İade kayıtları bir siparişe mahsup edilemez.",
    path: ["allocations"],
  })
  .refine(
    (data) => {
      const allocated = data.allocations.reduce((sum, a) => sum + a.amount, 0);
      return allocated <= data.amount + 0.0001; // ondalık yuvarlama payı
    },
    { message: "Mahsup edilen toplam, tahsilat tutarını aşamaz.", path: ["allocations"] },
  );

export type PaymentInput = z.infer<typeof paymentInputSchema>;

export const listPaymentsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  customerId: z.string().uuid().optional(),
  method: paymentMethodSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const cancelPaymentSchema = z.object({
  reason: z.string().trim().min(1, "İptal gerekçesi zorunlu").max(500),
});
