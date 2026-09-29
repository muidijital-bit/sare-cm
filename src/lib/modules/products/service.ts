import type { Prisma } from "@prisma/client";
import { withTenant } from "@/lib/db/tenant-context";
import { writeAuditLog, diffFields } from "@/lib/audit/log";
import { getScope } from "@/lib/auth/access";
import type { TenantSession } from "@/lib/auth/session";
import type { ProductInput } from "@/lib/validation/product";
import { type ServiceResult, forbidden, notFound } from "@/lib/modules/result";

interface ListParams {
  q?: string;
  page: number;
  pageSize: number;
}

export async function listProducts(session: TenantSession, params: ListParams) {
  if (!getScope(session, "product", "view")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(params.q ? { OR: [{ name: { contains: params.q, mode: "insensitive" } }, { code: { contains: params.q, mode: "insensitive" } }] } : {}),
    };
    const [items, total] = await Promise.all([
      tx.product.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: { defaultSupplier: { select: { id: true, title: true } } },
      }),
      tx.product.count({ where }),
    ]);
    return { ok: true as const, data: { items, total, page: params.page, pageSize: params.pageSize } };
  });
}

export async function getProduct(session: TenantSession, id: string): Promise<ServiceResult<NonNullable<Awaited<ReturnType<typeof getOne>>>>> {
  if (!getScope(session, "product", "view")) return forbidden();
  return withTenant(session.companyId, async (tx) => {
    const product = await getOne(tx, id);
    if (!product) return notFound();
    return { ok: true as const, data: product };
  });
}
function getOne(tx: Prisma.TransactionClient, id: string) {
  return tx.product.findFirst({ where: { id, deletedAt: null } });
}

export async function createProduct(session: TenantSession, input: ProductInput): Promise<ServiceResult<{ id: string }>> {
  if (!getScope(session, "product", "create")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    if (input.defaultSupplierId && !(await tx.supplier.findFirst({ where: { id: input.defaultSupplierId, deletedAt: null } }))) {
      return notFound("Tedarikçi bulunamadı.");
    }
    const product = await tx.product.create({
      data: {
        companyId: session.companyId,
        code: input.code || null,
        name: input.name,
        unit: input.unit,
        listPrice: input.listPrice,
        defaultCost: input.defaultCost ?? null,
        vatRate: input.vatRate,
        defaultSupplierId: input.defaultSupplierId ?? null,
        isActive: input.isActive,
      },
    });
    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "CREATE", entityType: "product", entityId: product.id });
    return { ok: true as const, data: { id: product.id } };
  });
}

export async function updateProduct(session: TenantSession, id: string, input: ProductInput): Promise<ServiceResult<{ id: string }>> {
  if (!getScope(session, "product", "edit")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.product.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return notFound();
    if (input.defaultSupplierId && !(await tx.supplier.findFirst({ where: { id: input.defaultSupplierId, deletedAt: null } }))) {
      return notFound("Tedarikçi bulunamadı.");
    }

    await tx.product.update({
      where: { id },
      data: {
        code: input.code || null,
        name: input.name,
        unit: input.unit,
        listPrice: input.listPrice,
        defaultCost: input.defaultCost ?? null,
        vatRate: input.vatRate,
        defaultSupplierId: input.defaultSupplierId ?? null,
        isActive: input.isActive,
      },
    });

    await writeAuditLog(tx, {
      companyId: session.companyId,
      userId: session.userId,
      action: "UPDATE",
      entityType: "product",
      entityId: id,
      changes: diffFields(
        { listPrice: existing.listPrice.toString(), isActive: existing.isActive },
        { listPrice: String(input.listPrice), isActive: input.isActive },
      ),
    });
    return { ok: true as const, data: { id } };
  });
}

/** Sert silme YOK — ürün geçmiş teklif/sipariş/satın alma satırlarından referans alınıyor
 *  olabilir (bkz. QuoteItem/OrderItem/PurchaseOrderItem). Yalnızca `deletedAt` ile seçicilerden
 *  gizlenir, geçmiş kayıtlardaki ürün adı/tutarı etkilenmez. */
export async function deleteProduct(session: TenantSession, id: string): Promise<ServiceResult<{ id: string }>> {
  if (!getScope(session, "product", "delete")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.product.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return notFound();

    await tx.product.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "DELETE", entityType: "product", entityId: id });
    return { ok: true as const, data: { id } };
  });
}
