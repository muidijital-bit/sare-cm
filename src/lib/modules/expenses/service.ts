import dayjs from "dayjs";
import type { Prisma } from "@prisma/client";
import { withTenant } from "@/lib/db/tenant-context";
import { writeAuditLog, diffFields } from "@/lib/audit/log";
import { getRequiredScope } from "@/lib/auth/rbac";
import type { TenantSession } from "@/lib/auth/session";
import type { ExpenseInput } from "@/lib/validation/expense";
import { type ServiceResult, forbidden, notFound } from "@/lib/modules/result";

interface ListParams {
  q?: string;
  categoryId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page: number;
  pageSize: number;
}

/**
 * GD-03: Tekrarlayan gider şablonlarından (isRecurringTemplate=true) vadesi gelmiş
 * somut kayıtları üretir. V1'de zamanlanmış görev (cron) altyapısı olmadığından, TK-07'de
 * kullanılan aynı "lazy" desen uygulanır: her listeleme öncesi eksik ay(lar) tamamlanır.
 * Yalnızca "MONTHLY" kuralı desteklenir (dokümandaki örnekler: aylık kira, abonelik).
 */
async function generateDueRecurringExpenses(tx: Prisma.TransactionClient, companyId: string): Promise<void> {
  const templates = await tx.expense.findMany({
    where: { companyId, isRecurringTemplate: true, deletedAt: null, recurringRule: "MONTHLY" },
  });

  const now = dayjs();
  for (const template of templates) {
    const lastGenerated = await tx.expense.findFirst({
      where: { parentExpenseId: template.id },
      orderBy: { spentAt: "desc" },
    });

    let next = lastGenerated ? dayjs(lastGenerated.spentAt).add(1, "month") : dayjs(template.spentAt);
    // Uzun süre çalıştırılmamışsa geriden kalan tüm ayları tek seferde tamamlar.
    while (next.isBefore(now) || next.isSame(now, "day")) {
      await tx.expense.create({
        data: {
          companyId,
          categoryId: template.categoryId,
          spentAt: next.toDate(),
          amount: template.amount,
          vatAmount: template.vatAmount,
          vendor: template.vendor,
          method: template.method,
          accountId: template.accountId,
          note: template.note,
          parentExpenseId: template.id,
          isRecurringTemplate: false,
          createdBy: template.createdBy,
        },
      });
      next = next.add(1, "month");
    }
  }
}

export async function listExpenses(session: TenantSession, params: ListParams) {
  if (!getRequiredScope(session.role, "expense", "view")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    await generateDueRecurringExpenses(tx, session.companyId);

    const where: Prisma.ExpenseWhereInput = {
      deletedAt: null,
      isRecurringTemplate: false, // şablonlar listede görünmez, yalnızca ürettikleri kayıtlar
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      ...(params.dateFrom || params.dateTo
        ? { spentAt: { ...(params.dateFrom ? { gte: params.dateFrom } : {}), ...(params.dateTo ? { lte: params.dateTo } : {}) } }
        : {}),
      ...(params.q ? { OR: [{ vendor: { contains: params.q, mode: "insensitive" } }, { note: { contains: params.q, mode: "insensitive" } }] } : {}),
    };

    const [items, total] = await Promise.all([
      tx.expense.findMany({
        where,
        orderBy: { spentAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: { category: { select: { name: true } }, account: { select: { name: true } } },
      }),
      tx.expense.count({ where }),
    ]);

    return { ok: true as const, data: { items, total, page: params.page, pageSize: params.pageSize } };
  });
}

const EXPENSE_DETAIL_INCLUDE = {
  category: { select: { id: true, name: true } },
  account: { select: { id: true, name: true } },
} satisfies Prisma.ExpenseInclude;

export type ExpenseDetail = Prisma.ExpenseGetPayload<{ include: typeof EXPENSE_DETAIL_INCLUDE }>;

export async function getExpense(session: TenantSession, id: string): Promise<ServiceResult<ExpenseDetail>> {
  if (!getRequiredScope(session.role, "expense", "view")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const expense = await tx.expense.findFirst({ where: { id, deletedAt: null }, include: EXPENSE_DETAIL_INCLUDE });
    if (!expense) return notFound();
    return { ok: true as const, data: expense };
  });
}

export async function createExpense(session: TenantSession, input: ExpenseInput): Promise<ServiceResult<{ id: string }>> {
  if (!getRequiredScope(session.role, "expense", "create")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const category = await tx.expenseCategory.findFirst({ where: { id: input.categoryId, deletedAt: null } });
    if (!category) return notFound("Kategori bulunamadı.");

    const expense = await tx.expense.create({
      data: {
        companyId: session.companyId,
        categoryId: input.categoryId,
        spentAt: input.spentAt,
        amount: input.amount,
        vatAmount: input.vatAmount,
        vendor: input.vendor || null,
        method: input.method || null,
        accountId: input.accountId || null,
        note: input.note || null,
        isRecurringTemplate: input.isRecurringTemplate,
        recurringRule: input.isRecurringTemplate ? input.recurringRule ?? "MONTHLY" : null,
        createdBy: session.userId,
      },
    });

    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "CREATE", entityType: "expense", entityId: expense.id });

    return { ok: true as const, data: { id: expense.id } };
  });
}

export async function updateExpense(session: TenantSession, id: string, input: ExpenseInput): Promise<ServiceResult<{ id: string }>> {
  if (!getRequiredScope(session.role, "expense", "edit")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.expense.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return notFound();

    await tx.expense.update({
      where: { id },
      data: {
        categoryId: input.categoryId,
        spentAt: input.spentAt,
        amount: input.amount,
        vatAmount: input.vatAmount,
        vendor: input.vendor || null,
        method: input.method || null,
        accountId: input.accountId || null,
        note: input.note || null,
        updatedBy: session.userId,
      },
    });

    await writeAuditLog(tx, {
      companyId: session.companyId,
      userId: session.userId,
      action: "UPDATE",
      entityType: "expense",
      entityId: id,
      changes: diffFields({ amount: existing.amount.toString() }, { amount: String(input.amount) }),
    });

    return { ok: true as const, data: { id } };
  });
}

export async function deleteExpense(session: TenantSession, id: string): Promise<ServiceResult<{ id: string }>> {
  if (!getRequiredScope(session.role, "expense", "delete")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.expense.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return notFound();

    await tx.expense.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: session.userId } });
    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "DELETE", entityType: "expense", entityId: id });

    return { ok: true as const, data: { id } };
  });
}

export interface CategoryReportRow {
  categoryId: string;
  categoryName: string;
  total: number;
}

/** GD-02: kategori bazlı raporlama. */
export async function getCategoryReport(session: TenantSession, dateFrom?: Date, dateTo?: Date): Promise<ServiceResult<CategoryReportRow[]>> {
  if (!getRequiredScope(session.role, "expense", "view")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    await generateDueRecurringExpenses(tx, session.companyId);

    const expenses = await tx.expense.findMany({
      where: {
        deletedAt: null,
        isRecurringTemplate: false,
        ...(dateFrom || dateTo ? { spentAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
      },
      include: { category: { select: { id: true, name: true } } },
    });

    const byCategory = new Map<string, CategoryReportRow>();
    for (const e of expenses) {
      const existing = byCategory.get(e.categoryId);
      const amount = Number(e.amount);
      if (existing) existing.total += amount;
      else byCategory.set(e.categoryId, { categoryId: e.categoryId, categoryName: e.category.name, total: amount });
    }

    return { ok: true as const, data: Array.from(byCategory.values()).sort((a, b) => b.total - a.total) };
  });
}
