import type { Prisma, OrderStatus } from "@prisma/client";
import { withTenant } from "@/lib/db/tenant-context";
import { writeAuditLog, diffFields } from "@/lib/audit/log";
import { getRequiredScope } from "@/lib/auth/rbac";
import type { TenantSession } from "@/lib/auth/session";
import type { OrderInput } from "@/lib/validation/order";
import { calculateDocument, type LineInput } from "@/lib/modules/documents/calculations";
import { nextDocumentNumber } from "@/lib/modules/documents/number-sequence";
import { type ServiceResult, forbidden, notFound, conflict } from "@/lib/modules/result";

interface ListParams {
  q?: string;
  status?: string;
  customerId?: string;
  ownerUserId?: string;
  page: number;
  pageSize: number;
}

function toLineInputs(items: OrderInput["items"]): LineInput[] {
  return items.map((i) => ({
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    discountType: i.discountType,
    discountValue: i.discountValue,
    vatRate: i.vatRate,
  }));
}

export async function listOrders(session: TenantSession, params: ListParams) {
  const scope = getRequiredScope(session.role, "order", "view");
  if (!scope) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const where: Prisma.OrderWhereInput = {
      deletedAt: null,
      ...(scope === "own" ? { ownerUserId: session.userId } : params.ownerUserId ? { ownerUserId: params.ownerUserId } : {}),
      ...(params.status ? { status: params.status as Prisma.EnumOrderStatusFilter["equals"] } : {}),
      ...(params.customerId ? { customerId: params.customerId } : {}),
      ...(params.q
        ? { OR: [{ number: { contains: params.q, mode: "insensitive" } }, { customer: { title: { contains: params.q, mode: "insensitive" } } }] }
        : {}),
    };

    const [items, total] = await Promise.all([
      tx.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: { customer: { select: { title: true } } },
      }),
      tx.order.count({ where }),
    ]);

    return { ok: true as const, data: { items, total, page: params.page, pageSize: params.pageSize } };
  });
}

const ORDER_DETAIL_INCLUDE = {
  customer: { select: { id: true, title: true, ownerUserId: true } },
  quote: { select: { id: true, number: true } },
  items: { include: { product: { select: { name: true } } }, orderBy: { sortOrder: "asc" } },
  paymentSchedules: { orderBy: { dueDate: "asc" } },
  paymentAllocations: { include: { payment: { select: { isCancelled: true, paidAt: true } } } },
} satisfies Prisma.OrderInclude;

export type OrderDetail = Prisma.OrderGetPayload<{ include: typeof ORDER_DETAIL_INCLUDE }>;

export interface PaymentStatus {
  total: number;
  collected: number;
  remaining: number;
  overdue: number;
}

/** SP-07: sipariş detayında ödeme durumu — toplam, tahsil edilen, kalan, vadesi geçmiş. */
export function computePaymentStatus(order: OrderDetail): PaymentStatus {
  const total = Number(order.grandTotal);
  const collected = order.paymentAllocations
    .filter((a) => !a.payment.isCancelled)
    .reduce((sum, a) => sum + Number(a.amount), 0);
  const remaining = Math.max(0, total - collected);

  const now = new Date();
  const overdueScheduled = order.paymentSchedules
    .filter((s) => s.dueDate < now)
    .reduce((sum, s) => sum + Number(s.amount), 0);
  const overdue = Math.min(remaining, overdueScheduled);

  return { total, collected, remaining, overdue };
}

export async function getOrder(session: TenantSession, id: string): Promise<ServiceResult<OrderDetail>> {
  const scope = getRequiredScope(session.role, "order", "view");
  if (!scope) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const order = await tx.order.findFirst({ where: { id, deletedAt: null }, include: ORDER_DETAIL_INCLUDE });
    if (!order) return notFound();
    if (scope === "own" && order.ownerUserId !== session.userId) return forbidden();

    return { ok: true as const, data: order };
  });
}

async function hasAnyPayments(tx: Prisma.TransactionClient, orderId: string): Promise<boolean> {
  const count = await tx.paymentAllocation.count({ where: { orderId, payment: { isCancelled: false } } });
  return count > 0;
}

export interface OpenOrderSummary {
  id: string;
  number: string;
  grandTotal: number;
  remaining: number;
}

/** TH-03 Mahsuplaşma formundaki sipariş seçici için: bir müşterinin açık (kalan bakiyeli) siparişleri. */
export async function listOpenOrdersForCustomer(session: TenantSession, customerId: string): Promise<ServiceResult<OpenOrderSummary[]>> {
  if (!getRequiredScope(session.role, "payment", "create")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const orders = await tx.order.findMany({
      where: { customerId, deletedAt: null, status: { not: "CANCELLED" } },
      include: { paymentAllocations: { where: { payment: { isCancelled: false } }, select: { amount: true } } },
      orderBy: { orderDate: "desc" },
    });

    const summaries = orders
      .map((o) => {
        const collected = o.paymentAllocations.reduce((sum, a) => sum + Number(a.amount), 0);
        return { id: o.id, number: o.number, grandTotal: Number(o.grandTotal), remaining: Number(o.grandTotal) - collected };
      })
      .filter((o) => o.remaining > 0.009);

    return { ok: true as const, data: summaries };
  });
}

export async function createOrder(session: TenantSession, input: OrderInput): Promise<ServiceResult<{ id: string }>> {
  const scope = getRequiredScope(session.role, "order", "create");
  if (!scope) return forbidden();

  const ownerUserId = scope === "own" ? session.userId : input.ownerUserId ?? session.userId;
  const { lines, totals } = calculateDocument(toLineInputs(input.items), input.documentDiscount ?? undefined);

  return withTenant(session.companyId, async (tx) => {
    const customer = await tx.customer.findFirst({ where: { id: input.customerId, deletedAt: null } });
    if (!customer) return notFound("Müşteri bulunamadı.");

    const company = await tx.company.findUniqueOrThrow({ where: { id: session.companyId } });
    const number = await nextDocumentNumber(tx, session.companyId, "ORDER", company.orderNumberFormat);

    const order = await tx.order.create({
      data: {
        companyId: session.companyId,
        number,
        customerId: input.customerId,
        quoteId: input.quoteId || null,
        status: "CONFIRMED",
        orderDate: input.orderDate,
        dueDate: input.dueDate || null,
        deliveryAddress: input.deliveryAddress || null,
        documentDiscountType: input.documentDiscount?.type,
        documentDiscountValue: input.documentDiscount?.value,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        vatTotal: totals.vatTotal,
        grandTotal: totals.grandTotal,
        ownerUserId,
        note: input.note || null,
        createdBy: session.userId,
      },
    });

    await tx.orderItem.createMany({
      data: input.items.map((item, i) => ({
        orderId: order.id,
        productId: item.productId || null,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        unitCost: item.unitCost ?? null,
        discountType: item.discountType,
        discountValue: item.discountValue,
        vatRate: item.vatRate,
        lineTotal: lines[i].lineTotal,
        sortOrder: i,
      })),
    });

    if (input.paymentSchedules.length > 0) {
      await tx.paymentSchedule.createMany({
        data: input.paymentSchedules.map((s) => ({
          orderId: order.id,
          dueDate: s.dueDate,
          amount: s.amount,
          description: s.description || null,
        })),
      });
    }

    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "CREATE", entityType: "order", entityId: order.id });

    return { ok: true as const, data: { id: order.id } };
  });
}

/** TK-08: kabul edilen tekliften tek tıkla sipariş — satırlar kopyalanır, bağlantı korunur. */
export async function createOrderFromQuote(session: TenantSession, quoteId: string): Promise<ServiceResult<{ id: string }>> {
  const createScope = getRequiredScope(session.role, "order", "create");
  const quoteScope = getRequiredScope(session.role, "quote", "view");
  if (!createScope || !quoteScope) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const quote = await tx.quote.findFirst({ where: { id: quoteId, deletedAt: null }, include: { items: true } });
    if (!quote) return notFound("Teklif bulunamadı.");
    if (quoteScope === "own" && quote.ownerUserId !== session.userId) return forbidden();
    if (quote.status !== "ACCEPTED") return conflict("Yalnızca kabul edilmiş teklifler siparişe dönüştürülebilir.");

    const existingOrder = await tx.order.findFirst({ where: { quoteId: quote.id, deletedAt: null } });
    if (existingOrder) return conflict("Bu teklif zaten bir siparişe dönüştürülmüş.");

    const company = await tx.company.findUniqueOrThrow({ where: { id: session.companyId } });
    const number = await nextDocumentNumber(tx, session.companyId, "ORDER", company.orderNumberFormat);

    const order = await tx.order.create({
      data: {
        companyId: session.companyId,
        number,
        customerId: quote.customerId,
        quoteId: quote.id,
        status: "CONFIRMED",
        orderDate: new Date(),
        documentDiscountType: quote.documentDiscountType,
        documentDiscountValue: quote.documentDiscountValue,
        subtotal: quote.subtotal,
        discountTotal: quote.discountTotal,
        vatTotal: quote.vatTotal,
        grandTotal: quote.grandTotal,
        ownerUserId: quote.ownerUserId,
        note: quote.note,
        createdBy: session.userId,
      },
    });

    await tx.orderItem.createMany({
      data: quote.items.map((item, i) => ({
        orderId: order.id,
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        unitCost: item.unitCost,
        discountType: item.discountType,
        discountValue: item.discountValue,
        vatRate: item.vatRate,
        lineTotal: item.lineTotal,
        sortOrder: i,
      })),
    });

    await writeAuditLog(tx, {
      companyId: session.companyId,
      userId: session.userId,
      action: "CREATE",
      entityType: "order",
      entityId: order.id,
      changes: { convertedFromQuote: { eski: null, yeni: quote.id } },
    });

    return { ok: true as const, data: { id: order.id } };
  });
}

export async function updateOrder(session: TenantSession, id: string, input: OrderInput): Promise<ServiceResult<{ id: string }>> {
  const scope = getRequiredScope(session.role, "order", "edit");
  if (!scope) return forbidden();

  const { lines, totals } = calculateDocument(toLineInputs(input.items), input.documentDiscount ?? undefined);

  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.order.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return notFound();
    if (scope === "own" && existing.ownerUserId !== session.userId) return forbidden();
    if (existing.status === "CANCELLED") return conflict("İptal edilmiş sipariş düzenlenemez.");

    // SP-08: Tahsilat yapılmış sipariş tutarı düşürülemez.
    if (await hasAnyPayments(tx, id)) {
      if (totals.grandTotal.lessThan(existing.grandTotal)) {
        return conflict("Bu siparişe tahsilat yapılmış; tutar düşürülemez.");
      }
    }

    const ownerUserId = scope === "own" ? existing.ownerUserId : input.ownerUserId ?? existing.ownerUserId;

    await tx.order.update({
      where: { id },
      data: {
        customerId: input.customerId,
        orderDate: input.orderDate,
        dueDate: input.dueDate || null,
        deliveryAddress: input.deliveryAddress || null,
        documentDiscountType: input.documentDiscount?.type,
        documentDiscountValue: input.documentDiscount?.value,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        vatTotal: totals.vatTotal,
        grandTotal: totals.grandTotal,
        ownerUserId,
        note: input.note || null,
        updatedBy: session.userId,
      },
    });

    await tx.orderItem.deleteMany({ where: { orderId: id } });
    await tx.orderItem.createMany({
      data: input.items.map((item, i) => ({
        orderId: id,
        productId: item.productId || null,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        unitCost: item.unitCost ?? null,
        discountType: item.discountType,
        discountValue: item.discountValue,
        vatRate: item.vatRate,
        lineTotal: lines[i].lineTotal,
        sortOrder: i,
      })),
    });

    await tx.paymentSchedule.deleteMany({ where: { orderId: id } });
    if (input.paymentSchedules.length > 0) {
      await tx.paymentSchedule.createMany({
        data: input.paymentSchedules.map((s) => ({
          orderId: id,
          dueDate: s.dueDate,
          amount: s.amount,
          description: s.description || null,
        })),
      });
    }

    await writeAuditLog(tx, {
      companyId: session.companyId,
      userId: session.userId,
      action: "UPDATE",
      entityType: "order",
      entityId: id,
      changes: diffFields({ grandTotal: existing.grandTotal.toString() }, { grandTotal: totals.grandTotal.toString() }),
    });

    return { ok: true as const, data: { id } };
  });
}

const ORDER_FORWARD_STATUS: Record<OrderStatus, OrderStatus | null> = {
  CONFIRMED: "PREPARING",
  PREPARING: "DELIVERED",
  DELIVERED: "COMPLETED",
  COMPLETED: null,
  CANCELLED: null,
};

/** SP-04: onaylandı → hazırlanıyor → teslim edildi → tamamlandı (yalnızca ileri yönde, sıralı). */
export async function advanceOrderStatus(session: TenantSession, id: string): Promise<ServiceResult<{ id: string; status: string }>> {
  const scope = getRequiredScope(session.role, "order", "edit");
  if (!scope) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.order.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return notFound();
    if (scope === "own" && existing.ownerUserId !== session.userId) return forbidden();

    const next = ORDER_FORWARD_STATUS[existing.status];
    if (!next) return conflict(`"${existing.status}" durumundan ileri gidilemez.`);

    await tx.order.update({ where: { id }, data: { status: next, updatedBy: session.userId } });
    await writeAuditLog(tx, {
      companyId: session.companyId,
      userId: session.userId,
      action: "UPDATE",
      entityType: "order",
      entityId: id,
      changes: { status: { eski: existing.status, yeni: next } },
    });

    return { ok: true as const, data: { id, status: next } };
  });
}

/** SP-04/SP-05: her aşamadan iptal mümkün — tutarlar ciro/açık alacaktan düşer (metrik sorgularında). */
export async function cancelOrder(session: TenantSession, id: string, reason: string): Promise<ServiceResult<{ id: string }>> {
  const scope = getRequiredScope(session.role, "order", "edit");
  if (!scope) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.order.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return notFound();
    if (scope === "own" && existing.ownerUserId !== session.userId) return forbidden();
    if (existing.status === "CANCELLED") return conflict("Sipariş zaten iptal edilmiş.");
    if (existing.status === "COMPLETED") return conflict("Tamamlanmış sipariş iptal edilemez.");

    await tx.order.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: session.userId, cancelReason: reason, updatedBy: session.userId },
    });
    await writeAuditLog(tx, {
      companyId: session.companyId,
      userId: session.userId,
      action: "UPDATE",
      entityType: "order",
      entityId: id,
      changes: { status: { eski: existing.status, yeni: "CANCELLED" }, cancelReason: { eski: null, yeni: reason } },
    });

    return { ok: true as const, data: { id } };
  });
}
