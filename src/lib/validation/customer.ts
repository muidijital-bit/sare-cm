import { z } from "zod";

/** §5.4 Müşteri / CRM — istemci ve sunucu tarafında PAYLAŞILAN doğrulama şemaları. */

export const customerTypeSchema = z.enum(["INDIVIDUAL", "CORPORATE"]);
export const customerStatusSchema = z.enum(["POTENTIAL", "ACTIVE", "PASSIVE", "LOST"]);
export const activityTypeSchema = z.enum(["PHONE", "EMAIL", "VISIT", "WHATSAPP", "OTHER"]);

export const contactInputSchema = z.object({
  id: z.string().uuid().optional(), // varsa güncellenir, yoksa yeni eklenir
  name: z.string().trim().min(1, "Ad zorunlu").max(200),
  position: z.string().trim().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  email: z.string().trim().email("Geçerli bir e-posta girin").optional().or(z.literal("")),
  isPrimary: z.boolean().default(false),
});

export const customerInputSchema = z.object({
  type: customerTypeSchema,
  title: z.string().trim().min(1, "Unvan/ad-soyad zorunlu").max(300),
  taxOffice: z.string().trim().max(200).optional().or(z.literal("")),
  taxNumber: z.string().trim().max(50).optional().or(z.literal("")),
  address: z.string().trim().max(1000).optional().or(z.literal("")),
  sourceId: z.string().uuid().optional().nullable(),
  status: customerStatusSchema.default("POTENTIAL"),
  // scope "own" olan roller için sunucu bunu her zaman kendi kullanıcı ID'sine zorlar
  // (bkz. src/lib/modules/customers/service.ts) — client'tan gelen değer öyle bir
  // durumda YOK SAYILIR, güvenlik sınırı sunucudadır.
  ownerUserId: z.string().uuid().optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  contacts: z.array(contactInputSchema).max(20).default([]),
});

export type CustomerInput = z.infer<typeof customerInputSchema>;

export const listCustomersQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: customerStatusSchema.optional(),
  sourceId: z.string().uuid().optional(),
  ownerUserId: z.string().uuid().optional(),
  tag: z.string().trim().max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const activityInputSchema = z.object({
  type: activityTypeSchema,
  occurredAt: z.coerce.date(),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
  contactId: z.string().uuid().optional().nullable(),
  nextAction: z.string().trim().max(500).optional().or(z.literal("")),
  remindAt: z.coerce.date().optional().nullable(),
});

export type ActivityInput = z.infer<typeof activityInputSchema>;
