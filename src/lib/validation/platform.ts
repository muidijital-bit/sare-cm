import { z } from "zod";

/** PF-01: yeni şirket oluşturma. */
export const createCompanyInputSchema = z.object({
  name: z.string().trim().min(1, "Şirket adı zorunlu").max(300),
  ownerEmail: z.string().trim().toLowerCase().email("Geçerli bir e-posta girin"),
  planId: z.string().uuid("Paket seçin"),
  subscriptionEndsAt: z.coerce.date().optional().nullable(),
});
export type CreateCompanyInput = z.infer<typeof createCompanyInputSchema>;

export const companyStatusInputSchema = z.object({
  status: z.enum(["TRIAL", "ACTIVE", "SUSPENDED"]),
});

/** PF-03: paket tanımları. */
export const createPlanInputSchema = z.object({
  name: z.string().trim().min(1, "Paket adı zorunlu").max(200),
  maxUsers: z.coerce.number().int().min(1),
  maxCustomers: z.coerce.number().int().min(1),
  maxStorageMb: z.coerce.number().int().min(1),
  price: z.coerce.number().min(0),
});
export type CreatePlanInput = z.infer<typeof createPlanInputSchema>;
