import { z } from "zod";

export const PROJECT_STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

const optionalDate = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.date().nullable());

export const projectInputSchema = z.object({
  name: z.string().trim().min(1, "Proje adı zorunlu").max(200),
  customerId: z.string().uuid("Müşteri seçin"),
  status: z.enum(PROJECT_STATUSES).default("PLANNED"),
  location: z.string().trim().max(300).optional().or(z.literal("")),
  startDate: optionalDate.optional(),
  endDate: optionalDate.optional(),
  contractAmount: z.coerce.number().min(0, "Sözleşme bedeli negatif olamaz").default(0),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type ProjectInput = z.infer<typeof projectInputSchema>;

export const listProjectsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  customerId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** Projede kullanılan malzeme — stoktan düşer. Birim maliyet boşsa ürünün güncel maliyeti alınır. */
export const projectMaterialInputSchema = z.object({
  productId: z.string().uuid("Ürün seçin"),
  quantity: z.coerce.number().positive("Miktar 0'dan büyük olmalı"),
  unitCost: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().min(0).optional()),
  usedAt: z.coerce.date(),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});
export type ProjectMaterialInput = z.infer<typeof projectMaterialInputSchema>;

export const projectLaborInputSchema = z.object({
  employeeId: z.preprocess((v) => (v === "" ? null : v), z.string().uuid().nullable().optional()),
  description: z.string().trim().min(1, "Açıklama zorunlu").max(300),
  workDate: z.coerce.date(),
  hours: z.coerce.number().positive("Saat 0'dan büyük olmalı").max(10000),
  hourlyCost: z.coerce.number().min(0, "Saatlik maliyet negatif olamaz"),
});
export type ProjectLaborInput = z.infer<typeof projectLaborInputSchema>;
