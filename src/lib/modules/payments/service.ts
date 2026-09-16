import type { Prisma } from "@prisma/client";
import { withTenant } from "@/lib/db/tenant-context";
import { writeAuditLog } from "@/lib/audit/log";
import { getRequiredScope } from "@/lib/auth/rbac";
import type { TenantSession } from "@/lib/auth/session";
import type { PaymentInput } from "@/lib/validation/payment";
import { type ServiceResult, forbidden, notFound, conflict } from "@/lib/modules/result";

interface ListParams {
  q?: string;
  customerId?: string;
  method?: string;
  page: number;
  pageSize: number;
}

export async function listPayments(session: TenantSession, params: ListParams) {
  if (!getRequiredScope(session.role, "payment", "view")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const where: Prisma.PaymentWhereInput = {
      ...(params.customerId ? { customerId: params.customerId } : {}),
      ...(params.method ? { method: params.method as Prisma.EnumPaymentMethodFilter["equals"] } : {}),
      ...(params.q ? { customer: { title: { contains: params.q, mode: "insensitive" } } } : {}),
    };

    const [items, total] = await Promise.all([
      tx.payment.findMany({
        where,
        orderBy: { paidAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: { customer: { select: { title: true } }, account: { select: { name: true } } },
      }),
      tx.payment.count({ where }),
    ]);

    return { ok: true as const, data: { items, total, page: params.page, pageSize: params.pageSize } };
  });
}

const PAYMENT_DETAIL_INCLUDE = {
  customer: { select: { id: true, title: true } },
  account: { select: { id: true, name: true } },
  allocations: { include: { order: { select: { id: true, number: true } } } },
} satisfies Prisma.PaymentInclude;

export type PaymentDetail = Prisma.PaymentGetPayload<{ include: typeof PAYMENT_DETAIL_INCLUDE }>;

export async function getPayment(session: TenantSession, id: string): Promise<ServiceResult<PaymentDetail>> {
  if (!getRequiredScope(session.role, "payment", "view")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const payment = await tx.payment.findFirst({ where: { id }, include: PAYMENT_DETAIL_INCLUDE });
    if (!payment) return notFound();
    return { ok: true as const, data: payment };
  });
}

async function getOrderRemaining(tx: Prisma.TransactionClient, orderId: string): Promise<Prisma.Decimal> {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  const allocations = await tx.paymentAllocation.findMany({
    where: { orderId, payment: { isCancelled: false } },
  });
  const collected = allocations.reduce((sum, a) => sum.add(a.amount), order.grandTotal.mul(0));
  return order.grandTotal.sub(collected);
}

export async function createPayment(session: TenantSession, input: PaymentInput): Promise<ServiceResult<{ id: string }>> {
  if (!getRequiredScope(session.role, "payment", "create")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const customer = await tx.customer.findFirst({ where: { id: input.customerId, deletedAt: null } });
    if (!customer) return notFound("Müşteri bulunamadı.");

    const account = await tx.account.findFirst({ where: { id: input.accountId, isActive: true } });
    if (!account) return notFound("Kasa/banka hesabı bulunamadı.");

    // TH-03 Mahsuplaşma: her sipariş bu şirkete/müşteriye ait olmalı ve kalan bakiyesini aşmamalı.
    for (const alloc of input.allocations) {
      const order = await tx.order.findFirst({ where: { id: alloc.orderId, customerId: input.customerId, deletedAt: null } });
      if (!order) return notFound(`Sipariş bulunamadı: ${alloc.orderId}`);
      const remaining = await getOrderRemaining(tx, alloc.orderId);
      if (remaining.lessThan(alloc.amount)) {
        return conflict(`"${order.number}" siparişinin kalan bakiyesi (${remaining.toFixed(2)}) mahsup tutarından az.`);
      }
    }

    const payment = await tx.payment.create({
      data: {
        companyId: session.companyId,
        customerId: input.customerId,
        accountId: input.accountId,
        paidAt: input.paidAt,
        amount: input.amount,
        method: input.method,
        reference: input.reference || null,
        note: input.note || null,
        createdBy: session.userId,
      },
    });

    if (input.allocations.length > 0) {
      await tx.paymentAllocation.createMany({
        data: input.allocations.map((a) => ({ paymentId: payment.id, orderId: a.orderId, amount: a.amount })),
      });
    }

    await writeAuditLog(tx, {
      companyId: session.companyId,
      userId: session.userId,
      action: "CREATE",
      entityType: "payment",
      entityId: payment.id,
    });

    return { ok: true as const, data: { id: payment.id } };
  });
}

/** TH-08: Tahsilat silme yerine iptal; iptal gerekçesi ve işlem geçmişi kaydı zorunlu. */
export async function cancelPayment(session: TenantSession, id: string, reason: string): Promise<ServiceResult<{ id: string }>> {
  if (!getRequiredScope(session.role, "payment", "delete")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.payment.findFirst({ where: { id } });
    if (!existing) return notFound();
    if (existing.isCancelled) return conflict("Tahsilat zaten iptal edilmiş.");

    await tx.payment.update({
      where: { id },
      data: { isCancelled: true, cancelReason: reason, cancelledAt: new Date(), cancelledBy: session.userId },
    });

    await writeAuditLog(tx, {
      companyId: session.companyId,
      userId: session.userId,
      action: "UPDATE",
      entityType: "payment",
      entityId: id,
      changes: { isCancelled: { eski: false, yeni: true }, cancelReason: { eski: null, yeni: reason } },
    });

    return { ok: true as const, data: { id } };
  });
}

export interface OverdueReceivable {
  orderId: string;
  orderNumber: string;
  customerTitle: string;
  dueDate: Date;
  amount: number;
  daysOverdue: number;
  ownerUserId: string;
}

/** TH-07: Vadesi geçmiş alacaklar listesi — gecikme günü, tutar, sorumlu, müşteri. */
export async function listOverdueReceivables(session: TenantSession): Promise<ServiceResult<OverdueReceivable[]>> {
  const scope = getRequiredScope(session.role, "payment", "view");
  if (!scope) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const now = new Date();
    const schedules = await tx.paymentSchedule.findMany({
      where: { dueDate: { lt: now }, order: { deletedAt: null, status: { not: "CANCELLED" } } },
      include: {
        order: {
          select: {
            id: true,
            number: true,
            ownerUserId: true,
            grandTotal: true,
            customer: { select: { title: true } },
            paymentAllocations: { where: { payment: { isCancelled: false } }, select: { amount: true } },
          },
        },
      },
    });

    const result: OverdueReceivable[] = [];
    for (const s of schedules) {
      const collected = s.order.paymentAllocations.reduce((sum, a) => sum + Number(a.amount), 0);
      const remaining = Number(s.order.grandTotal) - collected;
      if (remaining <= 0) continue;
      const amount = Math.min(remaining, Number(s.amount));
      if (amount <= 0) continue;
      result.push({
        orderId: s.order.id,
        orderNumber: s.order.number,
        customerTitle: s.order.customer.title,
        dueDate: s.dueDate,
        amount,
        daysOverdue: Math.floor((now.getTime() - s.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
        ownerUserId: s.order.ownerUserId,
      });
    }

    return { ok: true as const, data: result.filter((r) => scope === "all" || r.ownerUserId === session.userId) };
  });
}
