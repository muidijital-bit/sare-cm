import { z } from "zod";

/** SA-01/SA-02/SA-03/SA-07: şirket bilgileri + varsayılanlar. */
export const companySettingsInputSchema = z.object({
  name: z.string().trim().min(1, "Unvan zorunlu").max(300),
  taxOffice: z.string().trim().max(200).optional().or(z.literal("")),
  taxNumber: z.string().trim().max(50).optional().or(z.literal("")),
  address: z.string().trim().max(1000).optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  defaultVatRate: z.coerce.number().min(0).max(100),
  quoteValidityDays: z.coerce.number().int().min(1).max(365),
  quoteNumberFormat: z.string().trim().min(1).max(100),
  orderNumberFormat: z.string().trim().min(1).max(100),
});

export type CompanySettingsInput = z.infer<typeof companySettingsInputSchema>;

/** SA-04/SA-05/SA-06: basit adlandırılmış referans kayıtları (kaynak/kategori/hesap) ortak şeması. */
export const namedRefInputSchema = z.object({
  name: z.string().trim().min(1, "Ad zorunlu").max(200),
});

export const accountInputSchema = z.object({
  name: z.string().trim().min(1, "Ad zorunlu").max(200),
  type: z.enum(["CASH", "BANK"]),
});
