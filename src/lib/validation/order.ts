import { z } from "zod";
import { lineItemInputSchema, documentDiscountSchema } from "./document";

export const paymentScheduleInputSchema = z.object({
  dueDate: z.coerce.date(),
  amount: z.coerce.number().positive("Tutar 0'dan büyük olmalı"),
  description: z.string().trim().max(200).optional().or(z.literal("")),
});

export const orderInputSchema = z.object({
  customerId: z.string().uuid("Müşteri seçin"),
  quoteId: z.string().uuid().optional().nullable(),
  orderDate: z.coerce.date(),
  dueDate: z.coerce.date().optional().nullable(),
  deliveryAddress: z.string().trim().max(1000).optional().or(z.literal("")),
  ownerUserId: z.string().uuid().optional().nullable(),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
  documentDiscount: documentDiscountSchema,
  items: z.array(lineItemInputSchema).min(1, "En az bir satır ekleyin"),
  /** SP-06 Ödeme planı (peşinat + taksitler) — opsiyonel. */
  paymentSchedules: z.array(paymentScheduleInputSchema).max(24).default([]),
});

export type OrderInput = z.infer<typeof orderInputSchema>;

export const listOrdersQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(["CONFIRMED", "PREPARING", "DELIVERED", "COMPLETED", "CANCELLED"]).optional(),
  customerId: z.string().uuid().optional(),
  ownerUserId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(1, "İptal gerekçesi zorunlu").max(500),
});
