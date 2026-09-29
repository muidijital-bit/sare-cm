import dayjs from "dayjs";
import { Prisma, type TaxObligation } from "@prisma/client";
import { withTenant } from "@/lib/db/tenant-context";
import { writeAuditLog } from "@/lib/audit/log";
import { getScope } from "@/lib/auth/access";
import type { TenantSession } from "@/lib/auth/session";
import type { TaxObligationInput, PayTaxObligationInput } from "@/lib/validation/tax-obligation";
import { type ServiceResult, forbidden, notFound, conflict } from "@/lib/modules/result";
import { dateRange } from "@/lib/validation/list-filters";

interface ListParams {
  status?: string;
  type?: string;
  page: number;
  pageSize: number;
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * GD-03'teki (Expense) "lazy" tekrarlayan kayıt üretimiyle AYNI desen: cron altyapısı
 * olmadığından her listeleme öncesi vadesi gelmiş ay(lar) tamamlanır. Yalnızca "MONTHLY"
 * ve "QUARTERLY" kuralları desteklenir.
 */
async function generateDueRecurringObligations(tx: Prisma.TransactionClient, companyId: string): Promise<void> {
  const templates = await tx.taxObligation.findMany({ where: { companyId, isRecurringTemplate: true, deletedAt: null } });
  const now = dayjs();
  const step = (rule: string | null) => (rule === "QUARTERLY" ? 3 : 1);

  for (const template of templates) {
    const lastGenerated = await tx.taxObligation.findFirst({ where: { parentObligationId: template.id }, orderBy: { dueDate: "desc" } });
    let next = lastGenerated ? dayjs(lastGenerated.dueDate).add(step(template.recurringRule), "month") : dayjs(template.dueDate);
    while (next.isBefore(now) || next.isSame(now, "day")) {
      await tx.taxObligation.create({
        data: {
          companyId,
          type: template.type,
          period: next.format("YYYY-MM"),
          dueDate: next.toDate(),
          amount: template.amount,
          note: template.note,
          parentObligationId: template.id,
          isRecurringTemplate: false,
          createdBy: template.createdBy,
        },
      });
      next = next.add(step(template.recurringRule), "month");
    }
  }
}

export async function listTaxObligations(session: TenantSession, params: ListParams) {
  if (!getScope(session, "taxObligation", "view")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    await generateDueRecurringObligations(tx, session.companyId);

    const where: Prisma.TaxObligationWhereInput = {
      deletedAt: null,
      isRecurringTemplate: false,
      ...(params.status ? { status: params.status as Prisma.EnumTaxObligationStatusFilter["equals"] } : {}),
      ...(params.type ? { type: params.type as Prisma.EnumTaxObligationTypeFilter["equals"] } : {}),
      ...dateRange("dueDate", params.dateFrom, params.dateTo),
    };
    const [items, total] = await Promise.all([
      tx.taxObligation.findMany({ where, orderBy: { dueDate: "asc" }, skip: (params.page - 1) * params.pageSize, take: params.pageSize }),
      tx.taxObligation.count({ where }),
    ]);
    return { ok: true as const, data: { items, total, page: params.page, pageSize: params.pageSize } };
  });
}

/** Panel kartı: vadesi bugünden itibaren 30 gün içinde olan VEYA vadesi geçmiş, ödenmemiş kayıtlar. */
export async function getUpcomingObligations(session: TenantSession, limit = 5) {
  if (!getScope(session, "taxObligation", "view")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    await generateDueRecurringObligations(tx, session.companyId);
    const items = await tx.taxObligation.findMany({
      where: { deletedAt: null, isRecurringTemplate: false, status: "PENDING" },
      orderBy: { dueDate: "asc" },
      take: limit,
    });
    return { ok: true as const, data: items };
  });
}

export async function getTaxObligation(session: TenantSession, id: string): Promise<ServiceResult<TaxObligation>> {
  if (!getScope(session, "taxObligation", "view")) return forbidden();
  return withTenant(session.companyId, async (tx) => {
    const obligation = await tx.taxObligation.findFirst({ where: { id, deletedAt: null } });
    if (!obligation) return notFound();
    return { ok: true as const, data: obligation };
  });
}

export async function createTaxObligation(session: TenantSession, input: TaxObligationInput): Promise<ServiceResult<{ id: string }>> {
  if (!getScope(session, "taxObligation", "create")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const obligation = await tx.taxObligation.create({
      data: {
        companyId: session.companyId,
        type: input.type,
        period: input.period,
        dueDate: input.dueDate,
        amount: input.amount,
        note: input.note || null,
        isRecurringTemplate: input.isRecurringTemplate,
        recurringRule: input.isRecurringTemplate ? input.recurringRule ?? "MONTHLY" : null,
        createdBy: session.userId,
      },
    });
    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "CREATE", entityType: "tax_obligation", entityId: obligation.id });
    return { ok: true as const, data: { id: obligation.id } };
  });
}

export async function deleteTaxObligation(session: TenantSession, id: string): Promise<ServiceResult<{ id: string }>> {
  if (!getScope(session, "taxObligation", "delete")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.taxObligation.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return notFound();
    await tx.taxObligation.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "DELETE", entityType: "tax_obligation", entityId: id });
    return { ok: true as const, data: { id } };
  });
}

export async function payTaxObligation(session: TenantSession, id: string, input: PayTaxObligationInput): Promise<ServiceResult<{ id: string }>> {
  if (!getScope(session, "taxObligation", "edit")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const obligation = await tx.taxObligation.findFirst({ where: { id, deletedAt: null } });
    if (!obligation) return notFound();
    if (obligation.status === "PAID") return conflict("Bu yükümlülük zaten ödenmiş.");

    await tx.taxObligation.update({
      where: { id },
      data: { status: "PAID", paidAmount: input.paidAmount, paidAt: input.paidAt, accountId: input.accountId ?? null, updatedBy: session.userId },
    });
    await writeAuditLog(tx, {
      companyId: session.companyId,
      userId: session.userId,
      action: "UPDATE",
      entityType: "tax_obligation",
      entityId: id,
      changes: { status: { eski: "PENDING", yeni: "PAID" } },
    });
    return { ok: true as const, data: { id } };
  });
}
