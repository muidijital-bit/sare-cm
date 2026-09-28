import { Prisma } from "@prisma/client";
import { withTenant } from "@/lib/db/tenant-context";
import { writeAuditLog } from "@/lib/audit/log";
import { getScope } from "@/lib/auth/access";
import type { TenantSession } from "@/lib/auth/session";
import type { PayrollRunInput, PayrollRunItemInput } from "@/lib/validation/payroll";
import { calculatePayrollItem } from "./calc";
import { type ServiceResult, forbidden, notFound, conflict } from "@/lib/modules/result";

const { Decimal } = Prisma;

interface ListParams {
  status?: string;
  page: number;
  pageSize: number;
}

export async function listPayrollRuns(session: TenantSession, params: ListParams) {
  if (!getScope(session, "payroll", "view")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const where: Prisma.PayrollRunWhereInput = {
      deletedAt: null,
      ...(params.status ? { status: params.status as Prisma.EnumPayrollRunStatusFilter["equals"] } : {}),
    };
    const [items, total] = await Promise.all([
      tx.payrollRun.findMany({ where, orderBy: { period: "desc" }, skip: (params.page - 1) * params.pageSize, take: params.pageSize }),
      tx.payrollRun.count({ where }),
    ]);
    return { ok: true as const, data: { items, total, page: params.page, pageSize: params.pageSize } };
  });
}

const DETAIL_INCLUDE = {
  items: { include: { employee: { select: { id: true, fullName: true } } } },
  account: { select: { id: true, name: true } },
} satisfies Prisma.PayrollRunInclude;

export type PayrollRunDetail = Prisma.PayrollRunGetPayload<{ include: typeof DETAIL_INCLUDE }>;

export async function getPayrollRun(session: TenantSession, id: string): Promise<ServiceResult<PayrollRunDetail>> {
  if (!getScope(session, "payroll", "view")) return forbidden();
  return withTenant(session.companyId, async (tx) => {
    const run = await tx.payrollRun.findFirst({ where: { id, deletedAt: null }, include: DETAIL_INCLUDE });
    if (!run) return notFound();
    return { ok: true as const, data: run };
  });
}

function sumTotals(items: { grossSalary: Prisma.Decimal; employerSgkCost: Prisma.Decimal; netSalary: Prisma.Decimal }[]) {
  return {
    totalGross: items.reduce((s, i) => s.plus(i.grossSalary), new Decimal(0)),
    totalEmployerCost: items.reduce((s, i) => s.plus(i.grossSalary).plus(i.employerSgkCost), new Decimal(0)),
    totalNet: items.reduce((s, i) => s.plus(i.netSalary), new Decimal(0)),
  };
}

/**
 * Bordro dönemi açılınca o an ACTIVE olan tüm personel için kalemler otomatik ÖNERİLİR
 * (calc.ts ile tahmini hesaplanır) — admin DRAFT durumdayken her kalemi düzenleyebilir.
 */
export async function createPayrollRun(session: TenantSession, input: PayrollRunInput): Promise<ServiceResult<{ id: string }>> {
  if (!getScope(session, "payroll", "create")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.payrollRun.findFirst({ where: { period: input.period, deletedAt: null } });
    if (existing) return conflict(`${input.period} dönemi için zaten bir bordro var.`);

    const employees = await tx.employee.findMany({ where: { status: "ACTIVE", deletedAt: null } });
    const calcs = employees.map((e) => ({ employeeId: e.id, ...calculatePayrollItem(e.grossSalary) }));
    const totals = sumTotals(calcs);

    const run = await tx.payrollRun.create({
      data: {
        companyId: session.companyId,
        period: input.period,
        status: "DRAFT",
        note: input.note || null,
        totalGross: totals.totalGross,
        totalEmployerCost: totals.totalEmployerCost,
        totalNet: totals.totalNet,
        createdBy: session.userId,
      },
    });

    if (calcs.length > 0) {
      await tx.payrollRunItem.createMany({
        data: calcs.map((c) => ({
          payrollRunId: run.id,
          employeeId: c.employeeId,
          grossSalary: c.grossSalary,
          employeeSgkCut: c.employeeSgkCut,
          unemploymentCut: c.unemploymentCut,
          incomeTax: c.incomeTax,
          stampTax: c.stampTax,
          employerSgkCost: c.employerSgkCost,
          netSalary: c.netSalary,
        })),
      });
    }

    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "CREATE", entityType: "payroll_run", entityId: run.id });
    return { ok: true as const, data: { id: run.id } };
  });
}

/** DRAFT bordroda tek bir personel kalemini düzenler (admin tahmini oranları düzeltebilir). */
export async function updatePayrollRunItem(
  session: TenantSession,
  runId: string,
  itemId: string,
  input: PayrollRunItemInput,
): Promise<ServiceResult<{ id: string }>> {
  if (!getScope(session, "payroll", "edit")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const run = await tx.payrollRun.findFirst({ where: { id: runId, deletedAt: null }, include: { items: true } });
    if (!run) return notFound();
    if (run.status !== "DRAFT") return conflict("Yalnızca taslak bordrolarda kalem düzenlenebilir.");
    const item = run.items.find((i) => i.id === itemId);
    if (!item) return notFound("Bordro kalemi bulunamadı.");

    const netSalary = new Decimal(input.grossSalary)
      .minus(input.employeeSgkCut)
      .minus(input.unemploymentCut)
      .minus(input.incomeTax)
      .minus(input.stampTax);

    await tx.payrollRunItem.update({
      where: { id: itemId },
      data: {
        grossSalary: input.grossSalary,
        employeeSgkCut: input.employeeSgkCut,
        unemploymentCut: input.unemploymentCut,
        incomeTax: input.incomeTax,
        stampTax: input.stampTax,
        employerSgkCost: input.employerSgkCost,
        netSalary,
      },
    });

    const updatedItems = run.items.map((i) =>
      i.id === itemId
        ? { grossSalary: new Decimal(input.grossSalary), employerSgkCost: new Decimal(input.employerSgkCost), netSalary }
        : { grossSalary: i.grossSalary, employerSgkCost: i.employerSgkCost, netSalary: i.netSalary },
    );
    const totals = sumTotals(updatedItems);
    await tx.payrollRun.update({ where: { id: runId }, data: totals });

    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "UPDATE", entityType: "payroll_run_item", entityId: itemId });
    return { ok: true as const, data: { id: itemId } };
  });
}

/** DRAFT → COMPLETED: ödeme hesabı işaretlenir. V1'de otomatik Payment/Expense kaydı ÜRETİLMEZ
 *  (schema.prisma notu) — yalnızca "ödendi" damgası ve hangi hesaptan yapıldığı tutulur. */
export async function completePayrollRun(session: TenantSession, id: string, accountId: string): Promise<ServiceResult<{ id: string }>> {
  if (!getScope(session, "payroll", "edit")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const run = await tx.payrollRun.findFirst({ where: { id, deletedAt: null }, include: { items: true } });
    if (!run) return notFound();
    if (run.status !== "DRAFT") return conflict("Bordro zaten tamamlanmış.");
    if (run.items.length === 0) return conflict("Kalemi olmayan bir bordro tamamlanamaz.");

    const account = await tx.account.findFirst({ where: { id: accountId, deletedAt: null } });
    if (!account) return notFound("Hesap bulunamadı.");

    await tx.payrollRun.update({ where: { id }, data: { status: "COMPLETED", accountId, paidAt: new Date(), updatedBy: session.userId } });
    await writeAuditLog(tx, {
      companyId: session.companyId,
      userId: session.userId,
      action: "UPDATE",
      entityType: "payroll_run",
      entityId: id,
      changes: { status: { eski: "DRAFT", yeni: "COMPLETED" } },
    });
    return { ok: true as const, data: { id } };
  });
}

export async function deletePayrollRun(session: TenantSession, id: string): Promise<ServiceResult<{ id: string }>> {
  if (!getScope(session, "payroll", "delete")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const run = await tx.payrollRun.findFirst({ where: { id, deletedAt: null } });
    if (!run) return notFound();
    if (run.status !== "DRAFT") return conflict("Yalnızca taslak bordro silinebilir.");

    await tx.payrollRun.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "DELETE", entityType: "payroll_run", entityId: id });
    return { ok: true as const, data: { id } };
  });
}
