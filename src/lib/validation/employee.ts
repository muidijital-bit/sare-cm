import { z } from "zod";

/** §HR — Personel Yönetimi: yalnızca admin/yetkili rol veri girer, personel için ayrı giriş yok. */

/** TC Kimlik No — 11 haneli rakam (algoritma doğrulaması yapılmaz, V1'de yalnızca biçim kontrolü). */
const nationalIdSchema = z
  .string()
  .trim()
  .regex(/^\d{11}$/, "TC Kimlik No 11 haneli rakam olmalı")
  .optional()
  .or(z.literal(""));

export const employeeInputSchema = z.object({
  fullName: z.string().trim().min(1, "Ad soyad zorunlu").max(200),
  nationalId: nationalIdSchema,
  position: z.string().trim().max(150).optional().or(z.literal("")),
  department: z.string().trim().max(150).optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  email: z.string().trim().email("Geçerli bir e-posta girin").optional().or(z.literal("")),
  hireDate: z.coerce.date(),
  terminationDate: z.coerce.date().optional().nullable(),
  sgkSicilNo: z.string().trim().max(50).optional().or(z.literal("")),
  iban: z.string().trim().max(34).optional().or(z.literal("")),
  grossSalary: z.coerce.number().min(0, "Brüt maaş negatif olamaz"),
  status: z.enum(["ACTIVE", "ON_LEAVE", "TERMINATED"]).default("ACTIVE"),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type EmployeeInput = z.infer<typeof employeeInputSchema>;

export const listEmployeesQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(["ACTIVE", "ON_LEAVE", "TERMINATED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const leaveRequestInputSchema = z
  .object({
    employeeId: z.string().uuid("Personel seçin"),
    type: z.enum(["YILLIK", "UCRETSIZ", "HASTALIK", "DIGER"]),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    days: z.coerce.number().positive("Gün sayısı 0'dan büyük olmalı"),
    note: z.string().trim().max(1000).optional().or(z.literal("")),
  })
  .refine((v) => v.endDate >= v.startDate, { message: "Bitiş tarihi başlangıçtan önce olamaz", path: ["endDate"] });
export type LeaveRequestInput = z.infer<typeof leaveRequestInputSchema>;
