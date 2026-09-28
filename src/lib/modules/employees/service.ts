import type { Prisma } from "@prisma/client";
import { withTenant } from "@/lib/db/tenant-context";
import { writeAuditLog, diffFields } from "@/lib/audit/log";
import { getScope } from "@/lib/auth/access";
import type { TenantSession } from "@/lib/auth/session";
import type { EmployeeInput, LeaveRequestInput } from "@/lib/validation/employee";
import { type ServiceResult, forbidden, notFound } from "@/lib/modules/result";

interface ListParams {
  q?: string;
  status?: string;
  page: number;
  pageSize: number;
}

export async function listEmployees(session: TenantSession, params: ListParams) {
  if (!getScope(session, "employee", "view")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const where: Prisma.EmployeeWhereInput = {
      deletedAt: null,
      ...(params.status ? { status: params.status as Prisma.EnumEmployeeStatusFilter["equals"] } : {}),
      ...(params.q
        ? { OR: [{ fullName: { contains: params.q, mode: "insensitive" } }, { position: { contains: params.q, mode: "insensitive" } }, { department: { contains: params.q, mode: "insensitive" } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      tx.employee.findMany({ where, orderBy: { fullName: "asc" }, skip: (params.page - 1) * params.pageSize, take: params.pageSize }),
      tx.employee.count({ where }),
    ]);
    return { ok: true as const, data: { items, total, page: params.page, pageSize: params.pageSize } };
  });
}

const DETAIL_INCLUDE = {
  leaveRequests: { where: { deletedAt: null }, orderBy: { startDate: "desc" as const } },
} satisfies Prisma.EmployeeInclude;

export type EmployeeDetail = Prisma.EmployeeGetPayload<{ include: typeof DETAIL_INCLUDE }>;

export async function getEmployee(session: TenantSession, id: string): Promise<ServiceResult<EmployeeDetail>> {
  if (!getScope(session, "employee", "view")) return forbidden();
  return withTenant(session.companyId, async (tx) => {
    const employee = await tx.employee.findFirst({ where: { id, deletedAt: null }, include: DETAIL_INCLUDE });
    if (!employee) return notFound();
    return { ok: true as const, data: employee };
  });
}

export async function createEmployee(session: TenantSession, input: EmployeeInput): Promise<ServiceResult<{ id: string }>> {
  if (!getScope(session, "employee", "create")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const employee = await tx.employee.create({
      data: {
        companyId: session.companyId,
        fullName: input.fullName,
        nationalId: input.nationalId || null,
        position: input.position || null,
        department: input.department || null,
        phone: input.phone || null,
        email: input.email || null,
        hireDate: input.hireDate,
        terminationDate: input.terminationDate || null,
        sgkSicilNo: input.sgkSicilNo || null,
        iban: input.iban || null,
        grossSalary: input.grossSalary,
        status: input.status,
        note: input.note || null,
        createdBy: session.userId,
      },
    });
    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "CREATE", entityType: "employee", entityId: employee.id });
    return { ok: true as const, data: { id: employee.id } };
  });
}

export async function updateEmployee(session: TenantSession, id: string, input: EmployeeInput): Promise<ServiceResult<{ id: string }>> {
  if (!getScope(session, "employee", "edit")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.employee.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return notFound();

    await tx.employee.update({
      where: { id },
      data: {
        fullName: input.fullName,
        nationalId: input.nationalId || null,
        position: input.position || null,
        department: input.department || null,
        phone: input.phone || null,
        email: input.email || null,
        hireDate: input.hireDate,
        terminationDate: input.terminationDate || null,
        sgkSicilNo: input.sgkSicilNo || null,
        iban: input.iban || null,
        grossSalary: input.grossSalary,
        status: input.status,
        note: input.note || null,
        updatedBy: session.userId,
      },
    });

    await writeAuditLog(tx, {
      companyId: session.companyId,
      userId: session.userId,
      action: "UPDATE",
      entityType: "employee",
      entityId: id,
      changes: diffFields(
        { grossSalary: existing.grossSalary.toString(), status: existing.status },
        { grossSalary: String(input.grossSalary), status: input.status },
      ),
    });
    return { ok: true as const, data: { id } };
  });
}

export async function deleteEmployee(session: TenantSession, id: string): Promise<ServiceResult<{ id: string }>> {
  if (!getScope(session, "employee", "delete")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.employee.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return notFound();

    await tx.employee.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: session.userId } });
    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "DELETE", entityType: "employee", entityId: id });
    return { ok: true as const, data: { id } };
  });
}

// ---------------------------------------------------------------------------
// İzin takibi — admin tarafından girilir, onay akışı yok (V1).
// ---------------------------------------------------------------------------

export async function createLeaveRequest(session: TenantSession, input: LeaveRequestInput): Promise<ServiceResult<{ id: string }>> {
  if (!getScope(session, "employee", "edit")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const employee = await tx.employee.findFirst({ where: { id: input.employeeId, deletedAt: null } });
    if (!employee) return notFound("Personel bulunamadı.");

    const leave = await tx.leaveRequest.create({
      data: {
        companyId: session.companyId,
        employeeId: input.employeeId,
        type: input.type,
        startDate: input.startDate,
        endDate: input.endDate,
        days: input.days,
        note: input.note || null,
        createdBy: session.userId,
      },
    });
    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "CREATE", entityType: "leave_request", entityId: leave.id });
    return { ok: true as const, data: { id: leave.id } };
  });
}

export async function deleteLeaveRequest(session: TenantSession, id: string): Promise<ServiceResult<{ id: string }>> {
  if (!getScope(session, "employee", "edit")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.leaveRequest.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return notFound();

    await tx.leaveRequest.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "DELETE", entityType: "leave_request", entityId: id });
    return { ok: true as const, data: { id } };
  });
}
