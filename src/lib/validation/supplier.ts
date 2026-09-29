import { z } from "zod";

/** §SM — Tedarikçi/CRM ile aynı desende: istemci ve sunucu tarafında PAYLAŞILAN doğrulama şemaları. */

export const supplierInputSchema = z.object({
  title: z.string().trim().min(1, "Unvan zorunlu").max(300),
  taxOffice: z.string().trim().max(200).optional().or(z.literal("")),
  taxNumber: z.string().trim().max(50).optional().or(z.literal("")),
  address: z.string().trim().max(1000).optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  email: z.string().trim().email("Geçerli bir e-posta girin").optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});
export type SupplierInput = z.infer<typeof supplierInputSchema>;

export const listSuppliersQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  active: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
