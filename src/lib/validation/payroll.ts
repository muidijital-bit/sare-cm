import { z } from "zod";

/**
 * §HR/Bordro — bordro dönemi "YYYY-MM". Kalem tutarları hesap motoru (calc.ts) tarafından
 * ÖNERİLİR ama admin serbestçe düzenleyebilir (V1 sabitleri bir tahmindir, muhasebeciyle
 * doğrulanmalıdır) — bu yüzden şema önerilen değil, GİRİLEN/onaylanan tutarları kabul eder.
 */
export const payrollRunItemInputSchema = z.object({
  employeeId: z.string().uuid(),
  grossSalary: z.coerce.number().min(0),
  employeeSgkCut: z.coerce.number().min(0),
  unemploymentCut: z.coerce.number().min(0),
  incomeTax: z.coerce.number().min(0),
  stampTax: z.coerce.number().min(0),
  employerSgkCost: z.coerce.number().min(0),
});
export type PayrollRunItemInput = z.infer<typeof payrollRunItemInputSchema>;

export const payrollRunInputSchema = z.object({
  period: z.string().trim().regex(/^\d{4}-\d{2}$/, "Dönem YYYY-AA biçiminde olmalı (örn. 2026-01)"),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type PayrollRunInput = z.infer<typeof payrollRunInputSchema>;

export const completePayrollRunInputSchema = z.object({
  accountId: z.string().uuid("Ödeme yapılacak hesabı seçin"),
});

export const listPayrollRunsQuerySchema = z.object({
  status: z.enum(["DRAFT", "COMPLETED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
