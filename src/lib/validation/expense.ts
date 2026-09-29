import { z } from "zod";
import { dateFromParam, dateToParam } from "./list-filters";

export const expenseInputSchema = z.object({
  categoryId: z.string().uuid("Kategori seçin"),
  spentAt: z.coerce.date(),
  amount: z.coerce.number().positive("Tutar 0'dan büyük olmalı"),
  vatAmount: z.coerce.number().min(0).default(0),
  vendor: z.string().trim().max(300).optional().or(z.literal("")),
  method: z.enum(["CASH", "BANK_TRANSFER", "CREDIT_CARD", "CHECK"]).optional().nullable(),
  accountId: z.string().uuid().optional().nullable(),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
  /** Projeye ait gider ise — proje kârlılığına maliyet olarak yazılır. */
  projectId: z.preprocess((v) => (v === "" ? null : v), z.string().uuid().nullable().optional()),
  /** GD-03: yalnızca şablon (isRecurringTemplate=true) oluştururken kullanılır. */
  isRecurringTemplate: z.boolean().default(false),
  recurringRule: z.enum(["MONTHLY"]).optional().nullable(),
});

export type ExpenseInput = z.infer<typeof expenseInputSchema>;

export const listExpensesQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  categoryId: z.string().uuid().optional(),
  dateFrom: dateFromParam,
  dateTo: dateToParam,
  projectId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
