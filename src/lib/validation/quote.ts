import { z } from "zod";
import { lineItemInputSchema, documentDiscountSchema } from "./document";

export const quoteInputSchema = z.object({
  customerId: z.string().uuid("Müşteri seçin"),
  contactId: z.string().uuid().optional().nullable(),
  issueDate: z.coerce.date(),
  validUntil: z.coerce.date(),
  ownerUserId: z.string().uuid().optional().nullable(),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
  documentDiscount: documentDiscountSchema,
  items: z.array(lineItemInputSchema).min(1, "En az bir satır ekleyin"),
});

export type QuoteInput = z.infer<typeof quoteInputSchema>;

export const listQuotesQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"]).optional(),
  customerId: z.string().uuid().optional(),
  ownerUserId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
