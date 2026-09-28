import type { Prisma } from "@prisma/client";
import { withTenant } from "@/lib/db/tenant-context";
import { writeAuditLog } from "@/lib/audit/log";
import { getScope } from "@/lib/auth/access";
import type { TenantSession } from "@/lib/auth/session";
import type { SupplierInput } from "@/lib/validation/supplier";
import { type ServiceResult, forbidden, notFound, conflict } from "@/lib/modules/result";

interface ListParams {
  q?: string;
  page: number;
  pageSize: number;
}

/** Müşteri listesiyle aynı desen (bkz. src/lib/modules/customers/service.ts listCustomers). */
export async function listSuppliers(session: TenantSession, params: ListParams, tx?: Prisma.TransactionClient) {
  if (!getScope(session, "supplier", "view")) return forbidden();

  const run = async (tx: Prisma.TransactionClient) => {
    const where: Prisma.SupplierWhereInput = {
      deletedAt: null,
      ...(params.q
        ? {
            OR: [
              { title: { contains: params.q, mode: "insensitive" } },
              { taxNumber: { contains: params.q } },
              { phone: { contains: params.q } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      tx.supplier.findMany({ where, orderBy: { createdAt: "desc" }, skip: (params.page - 1) * params.pageSize, take: params.pageSize }),
      tx.supplier.count({ where }),
    ]);

    return { ok: true as const, data: { items, total, page: params.page, pageSize: params.pageSize } };
  };

  return tx ? run(tx) : withTenant(session.companyId, run);
}

export async function getSupplier(session: TenantSession, id: string): Promise<ServiceResult<Prisma.SupplierGetPayload<object>>> {
  if (!getScope(session, "supplier", "view")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const supplier = await tx.supplier.findFirst({ where: { id, deletedAt: null } });
    if (!supplier) return notFound();
    return { ok: true as const, data: supplier };
  });
}

export async function createSupplier(session: TenantSession, input: SupplierInput): Promise<ServiceResult<{ id: string }>> {
  if (!getScope(session, "supplier", "create")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const supplier = await tx.supplier.create({
      data: {
        companyId: session.companyId,
        title: input.title,
        taxOffice: input.taxOffice || null,
        taxNumber: input.taxNumber || null,
        address: input.address || null,
        phone: input.phone || null,
        email: input.email || null,
        isActive: input.isActive,
        createdBy: session.userId,
      },
    });
    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "CREATE", entityType: "supplier", entityId: supplier.id });
    return { ok: true as const, data: { id: supplier.id } };
  });
}

export async function updateSupplier(session: TenantSession, id: string, input: SupplierInput): Promise<ServiceResult<{ id: string }>> {
  if (!getScope(session, "supplier", "edit")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.supplier.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return notFound();

    await tx.supplier.update({
      where: { id },
      data: {
        title: input.title,
        taxOffice: input.taxOffice || null,
        taxNumber: input.taxNumber || null,
        address: input.address || null,
        phone: input.phone || null,
        email: input.email || null,
        isActive: input.isActive,
        updatedBy: session.userId,
      },
    });
    await writeAuditLog(tx, {
      companyId: session.companyId,
      userId: session.userId,
      action: "UPDATE",
      entityType: "supplier",
      entityId: id,
      changes: { title: { eski: existing.title, yeni: input.title } },
    });
    return { ok: true as const, data: { id } };
  });
}

export async function deleteSupplier(session: TenantSession, id: string): Promise<ServiceResult<{ id: string }>> {
  if (!getScope(session, "supplier", "delete")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.supplier.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return notFound();

    const orderCount = await tx.purchaseOrder.count({ where: { supplierId: id, deletedAt: null } });
    if (orderCount > 0) return conflict("Bu tedarikçiye bağlı alım kaydı olduğu için silinemez. Pasife almayı deneyin.");

    await tx.supplier.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: session.userId } });
    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "DELETE", entityType: "supplier", entityId: id });
    return { ok: true as const, data: { id } };
  });
}
