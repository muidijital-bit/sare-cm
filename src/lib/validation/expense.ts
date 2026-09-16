import { z } from "zod";

export const expenseInputSchema = z.object({
  categoryId: z.string().uuid("Kategori seçin"),
  spentAt: z.coerce.date(),
  amount: z.coerce.number().positive("Tutar 0'dan büyük olmalı"),
  vatAmount: z.coerce.number().min(0).default(0),
  vendor: z.string().trim().max(300).optional().or(z.literal("")),
  method: z.enum(["CASH", "BANK_TRANSFER", "CREDIT_CARD", "CHECK"]).optional().nullable(),
  accountId: z.string().uuid().optional().nullable(),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
  /** GD-03: yalnızca şablon (isRecurringTemplate=true) oluştururken kullanılır. */
  isRecurringTemplate: z.boolean().default(false),
  recurringRule: z.enum(["MONTHLY"]).optional().nullable(),
});

export type ExpenseInput = z.infer<typeof expenseInputSchema>;

export const listExpensesQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  categoryId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
