import { Prisma } from "@prisma/client";
import { withTenant } from "@/lib/db/tenant-context";
import { writeAuditLog } from "@/lib/audit/log";
import { getScope } from "@/lib/auth/access";
import type { TenantSession } from "@/lib/auth/session";
import type { PurchaseOrderInput, StockAdjustmentInput } from "@/lib/validation/purchase-order";
import { nextDocumentNumber } from "@/lib/modules/documents/number-sequence";
import { applyStockDeltas } from "@/lib/modules/orders/stock";
import { type ServiceResult, forbidden, notFound, conflict } from "@/lib/modules/result";

const { Decimal } = Prisma;

interface ListParams {
  q?: string;
  status?: string;
  supplierId?: string;
  page: number;
  pageSize: number;
}

interface ItemTotal {
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  vatRate: Prisma.Decimal;
  lineTotal: Prisma.Decimal; // KDV hariç
  lineVat: Prisma.Decimal;
}

/**
 * SM-02: satın alma toplamları — tekliften/siparişten daha basit, iskonto YOK (yalnızca
 * miktar × birim maliyet + KDV). Farklı bir hesap dosyası (documents/calculations.ts değil):
 * o dosya iskonto/KDV matrahı ayrımını da yönetiyor, burada gerek yok — gereksiz karmaşıklık
 * eklemektense ayrı, sade bir hesap tutulur.
 */
function calculateItems(items: { quantity: number; unitCost: number; vatRate: number }[]): { lines: ItemTotal[]; subtotal: Prisma.Decimal; vatTotal: Prisma.Decimal; total: Prisma.Decimal } {
  const lines = items.map((it) => {
    const quantity = new Decimal(it.quantity);
    const unitCost = new Decimal(it.unitCost);
    const vatRate = new Decimal(it.vatRate);
    const lineTotal = quantity.times(unitCost).toDecimalPlaces(2);
    const lineVat = lineTotal.times(vatRate).dividedBy(100).toDecimalPlaces(2);
    return { quantity, unitCost, vatRate, lineTotal, lineVat };
  });
  const subtotal = lines.reduce((sum, l) => sum.plus(l.lineTotal), new Decimal(0));
  const vatTotal = lines.reduce((sum, l) => sum.plus(l.lineVat), new Decimal(0));
  return { lines, subtotal, vatTotal, total: subtotal.plus(vatTotal) };
}

export async function listPurchaseOrders(session: TenantSession, params: ListParams) {
  if (!getScope(session, "supplier", "view")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const where: Prisma.PurchaseOrderWhereInput = {
      deletedAt: null,
      ...(params.status ? { status: params.status as Prisma.EnumPurchaseOrderStatusFilter["equals"] } : {}),
      ...(params.supplierId ? { supplierId: params.supplierId } : {}),
      ...(params.q ? { OR: [{ number: { contains: params.q, mode: "insensitive" } }, { supplier: { title: { contains: params.q, mode: "insensitive" } } }] } : {}),
    };
    const [items, total] = await Promise.all([
      tx.purchaseOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: { supplier: { select: { title: true } } },
      }),
      tx.purchaseOrder.count({ where }),
    ]);
    return { ok: true as const, data: { items, total, page: params.page, pageSize: params.pageSize } };
  });
}

const DETAIL_INCLUDE = {
  supplier: { select: { id: true, title: true } },
  items: { include: { product: { select: { id: true, name: true } } } },
} satisfies Prisma.PurchaseOrderInclude;

export type PurchaseOrderDetail = Prisma.PurchaseOrderGetPayload<{ include: typeof DETAIL_INCLUDE }>;

export async function getPurchaseOrder(session: TenantSession, id: string): Promise<ServiceResult<PurchaseOrderDetail>> {
  if (!getScope(session, "supplier", "view")) return forbidden();
  return withTenant(session.companyId, async (tx) => {
    const po = await tx.purchaseOrder.findFirst({ where: { id, deletedAt: null }, include: DETAIL_INCLUDE });
    if (!po) return notFound();
    return { ok: true as const, data: po };
  });
}

export async function createPurchaseOrder(session: TenantSession, input: PurchaseOrderInput): Promise<ServiceResult<{ id: string }>> {
  if (!getScope(session, "supplier", "create")) return forbidden();

  const { lines, subtotal, vatTotal, total } = calculateItems(input.items);

  return withTenant(session.companyId, async (tx) => {
    const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, deletedAt: null } });
    if (!supplier) return notFound("Tedarikçi bulunamadı.");

    const company = await tx.company.findUniqueOrThrow({ where: { id: session.companyId } });
    const number = await nextDocumentNumber(tx, session.companyId, "PURCHASE", company.purchaseOrderNumberFormat);

    const po = await tx.purchaseOrder.create({
      data: {
        companyId: session.companyId,
        supplierId: input.supplierId,
        number,
        status: "DRAFT",
        orderedAt: input.orderedAt,
        subtotal,
        vatTotal,
        total,
        note: input.note || null,
        createdBy: session.userId,
      },
    });

    await tx.purchaseOrderItem.createMany({
      data: input.items.map((item, i) => ({
        purchaseOrderId: po.id,
        productId: item.productId || null,
        description: item.description,
        quantity: lines[i].quantity,
        unitCost: lines[i].unitCost,
        vatRate: lines[i].vatRate,
        lineTotal: lines[i].lineTotal,
      })),
    });

    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "CREATE", entityType: "purchase_order", entityId: po.id });
    return { ok: true as const, data: { id: po.id } };
  });
}

/**
 * SM-02: alım "Teslim Alındı" işaretlenince (yalnızca o an) stoğa girer VE ürünün güncel
 * maliyeti bu alımın birim fiyatına güncellenir. Bilinçli basitleştirme: ağırlıklı ortalama
 * maliyet DEĞİL, en son alım fiyatı kullanılır — V1 kapsamında KOBİ'ler için yeterli
 * görüldü (bkz. calculations.ts'teki benzer "basit taraf seçildi" kararları).
 */
export async function receivePurchaseOrder(session: TenantSession, id: string): Promise<ServiceResult<{ id: string }>> {
  if (!getScope(session, "supplier", "edit")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const po = await tx.purchaseOrder.findFirst({ where: { id, deletedAt: null }, include: { items: true } });
    if (!po) return notFound();
    if (po.status !== "DRAFT") return conflict("Yalnızca taslak alımlar teslim alınmış olarak işaretlenebilir.");

    await tx.purchaseOrder.update({ where: { id }, data: { status: "RECEIVED", receivedAt: new Date(), updatedBy: session.userId } });

    const deltas = po.items.filter((it) => it.productId).map((it) => ({ productId: it.productId!, delta: it.quantity }));
    await applyStockDeltas(tx, { companyId: session.companyId, deltas, type: "PURCHASE", createdBy: session.userId, purchaseOrderId: id });

    for (const it of po.items) {
      if (it.productId) await tx.product.update({ where: { id: it.productId }, data: { defaultCost: it.unitCost } });
    }

    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "UPDATE", entityType: "purchase_order", entityId: id, changes: { status: { eski: "DRAFT", yeni: "RECEIVED" } } });
    return { ok: true as const, data: { id } };
  });
}

export async function cancelPurchaseOrder(session: TenantSession, id: string): Promise<ServiceResult<{ id: string }>> {
  if (!getScope(session, "supplier", "delete")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const po = await tx.purchaseOrder.findFirst({ where: { id, deletedAt: null } });
    if (!po) return notFound();
    if (po.status === "CANCELLED") return conflict("Alım zaten iptal edilmiş.");

    // Teslim alınmıştı: stoğa girmiş miktarları tersine çevir (sipariş iptalinde olduğu gibi).
    if (po.status === "RECEIVED") {
      const movements = await tx.stockMovement.groupBy({ by: ["productId"], where: { purchaseOrderId: id }, _sum: { quantity: true } });
      const deltas = movements.map((m) => ({ productId: m.productId, delta: (m._sum.quantity ?? new Decimal(0)).negated() }));
      await applyStockDeltas(tx, { companyId: session.companyId, deltas, type: "ADJUSTMENT", createdBy: session.userId, purchaseOrderId: id, note: "Alım iptali" });
    }

    await tx.purchaseOrder.update({ where: { id }, data: { status: "CANCELLED", updatedBy: session.userId } });
    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "UPDATE", entityType: "purchase_order", entityId: id, changes: { status: { eski: po.status, yeni: "CANCELLED" } } });
    return { ok: true as const, data: { id } };
  });
}

/** Manuel stok düzeltmesi (sayım farkı vb.) — İşlem Geçmişi'nde her zaman izlenebilir. */
export async function adjustStock(session: TenantSession, input: StockAdjustmentInput): Promise<ServiceResult<{ id: string }>> {
  if (!getScope(session, "supplier", "edit")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const product = await tx.product.findFirst({ where: { id: input.productId, deletedAt: null } });
    if (!product) return notFound("Ürün bulunamadı.");

    await applyStockDeltas(tx, {
      companyId: session.companyId,
      deltas: [{ productId: input.productId, delta: new Decimal(input.quantity) }],
      type: "ADJUSTMENT",
      createdBy: session.userId,
      note: input.note,
    });
    await writeAuditLog(tx, {
      companyId: session.companyId,
      userId: session.userId,
      action: "UPDATE",
      entityType: "product_stock",
      entityId: input.productId,
      changes: { stockAdjustment: { eski: null, yeni: `${input.quantity > 0 ? "+" : ""}${input.quantity} (${input.note})` } },
    });
    return { ok: true as const, data: { id: input.productId } };
  });
}

export interface ProductStockDetail {
  stockQty: string;
  defaultCost: string | null;
  movements: { id: string; type: string; quantity: string; note: string | null; createdAt: Date }[];
}

/** Ürün detay sayfasında "Stok" sekmesi için — hareket geçmişi + güncel miktar/maliyet. */
export async function getProductStock(session: TenantSession, productId: string): Promise<ServiceResult<ProductStockDetail>> {
  if (!getScope(session, "supplier", "view")) return forbidden();
  return withTenant(session.companyId, async (tx) => {
    const product = await tx.product.findFirst({ where: { id: productId, deletedAt: null } });
    if (!product) return notFound();
    const movements = await tx.stockMovement.findMany({ where: { productId }, orderBy: { createdAt: "desc" }, take: 50 });
    return {
      ok: true as const,
      data: {
        stockQty: product.stockQty.toString(),
        defaultCost: product.defaultCost?.toString() ?? null,
        movements: movements.map((m) => ({ id: m.id, type: m.type, quantity: m.quantity.toString(), note: m.note, createdAt: m.createdAt })),
      },
    };
  });
}
