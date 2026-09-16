import type { Prisma } from "@prisma/client";
import { withTenant } from "@/lib/db/tenant-context";
import { writeAuditLog, diffFields } from "@/lib/audit/log";
import { getRequiredScope } from "@/lib/auth/rbac";
import type { TenantSession } from "@/lib/auth/session";
import type { CustomerInput, ActivityInput } from "@/lib/validation/customer";
import { type ServiceResult, forbidden, notFound, conflict } from "@/lib/modules/result";

interface ListParams {
  q?: string;
  status?: string;
  sourceId?: string;
  ownerUserId?: string;
  tag?: string;
  page: number;
  pageSize: number;
}

/** MC-11 Liste ekranı: arama (unvan, telefon, vergi no) + filtre + sunucu taraflı sayfalama. */
export async function listCustomers(session: TenantSession, params: ListParams) {
  const scope = getRequiredScope(session.role, "customer", "view");
  if (!scope) return forbidden();
  const ownScope = scope === "own";

  return withTenant(session.companyId, async (tx) => {
    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      ...(ownScope ? { ownerUserId: session.userId } : params.ownerUserId ? { ownerUserId: params.ownerUserId } : {}),
      ...(params.status ? { status: params.status as Prisma.EnumCustomerStatusFilter["equals"] } : {}),
      ...(params.sourceId ? { sourceId: params.sourceId } : {}),
      ...(params.tag ? { tags: { some: { tag: { name: params.tag } } } } : {}),
      ...(params.q
        ? {
            OR: [
              { title: { contains: params.q, mode: "insensitive" } },
              { taxNumber: { contains: params.q } },
              { contacts: { some: { phone: { contains: params.q } } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      tx.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: {
          source: { select: { name: true } },
          tags: { include: { tag: { select: { name: true } } } },
        },
      }),
      tx.customer.count({ where }),
    ]);

    return { ok: true as const, data: { items, total, page: params.page, pageSize: params.pageSize } };
  });
}

const CUSTOMER_DETAIL_INCLUDE = {
  source: { select: { name: true } },
  contacts: { where: { deletedAt: null }, orderBy: { isPrimary: "desc" } },
  tags: { include: { tag: { select: { id: true, name: true } } } },
  activities: { where: { deletedAt: null }, orderBy: { occurredAt: "desc" }, take: 20 },
} satisfies Prisma.CustomerInclude;

export type CustomerDetail = Prisma.CustomerGetPayload<{ include: typeof CUSTOMER_DETAIL_INCLUDE }>;

export async function getCustomer(session: TenantSession, id: string): Promise<ServiceResult<CustomerDetail>> {
  const scope = getRequiredScope(session.role, "customer", "view");
  if (!scope) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id, deletedAt: null },
      include: CUSTOMER_DETAIL_INCLUDE,
    });
    if (!customer) return notFound();
    if (scope === "own" && customer.ownerUserId !== session.userId) return forbidden();

    return { ok: true as const, data: customer };
  });
}

export interface CustomerBalance {
  totalOrders: number;
  totalPayments: number;
  openReceivable: number;
  overdue: number;
}

/** MC-10: Müşteri özetinde güncel bakiye — toplam sipariş, toplam tahsilat, açık alacak, vadesi geçmiş. */
export async function getCustomerBalance(session: TenantSession, customerId: string): Promise<ServiceResult<CustomerBalance>> {
  if (!getRequiredScope(session.role, "customer", "view")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const [ordersAgg, paymentsAgg, schedules] = await Promise.all([
      tx.order.aggregate({ where: { customerId, status: { not: "CANCELLED" }, deletedAt: null }, _sum: { grandTotal: true } }),
      tx.payment.aggregate({ where: { customerId, isCancelled: false }, _sum: { amount: true } }),
      tx.paymentSchedule.findMany({
        where: { dueDate: { lt: new Date() }, order: { customerId, deletedAt: null, status: { not: "CANCELLED" } } },
        include: { order: { include: { paymentAllocations: { where: { payment: { isCancelled: false } }, select: { amount: true } } } } },
      }),
    ]);

    const totalOrders = Number(ordersAgg._sum.grandTotal ?? 0);
    const totalPayments = Number(paymentsAgg._sum.amount ?? 0);
    const openReceivable = totalOrders - totalPayments;

    let overdue = 0;
    for (const s of schedules) {
      const collected = s.order.paymentAllocations.reduce((sum, a) => sum + Number(a.amount), 0);
      const remaining = Number(s.order.grandTotal) - collected;
      if (remaining > 0) overdue += Math.min(remaining, Number(s.amount));
    }

    return { ok: true as const, data: { totalOrders, totalPayments, openReceivable, overdue } };
  });
}

/** MC-14: bağlı teklif/sipariş varsa silme engellenir. */
async function hasLinkedDocuments(tx: Prisma.TransactionClient, customerId: string): Promise<boolean> {
  const [quoteCount, orderCount] = await Promise.all([
    tx.quote.count({ where: { customerId, deletedAt: null } }),
    tx.order.count({ where: { customerId, deletedAt: null } }),
  ]);
  return quoteCount > 0 || orderCount > 0;
}

export async function createCustomer(session: TenantSession, input: CustomerInput): Promise<ServiceResult<{ id: string }>> {
  const scope = getRequiredScope(session.role, "customer", "create");
  if (!scope) return forbidden();

  // "own" kapsamındaki roller yalnızca kendi adlarına kayıt açabilir — client'tan gelen
  // ownerUserId'ye güvenilmez (bkz. .claude/agents/auth-tenant-security.md).
  const ownerUserId = scope === "own" ? session.userId : input.ownerUserId ?? session.userId;

  return withTenant(session.companyId, async (tx) => {
    const customer = await tx.customer.create({
      data: {
        companyId: session.companyId,
        type: input.type,
        title: input.title,
        taxOffice: input.taxOffice || null,
        taxNumber: input.taxNumber || null,
        address: input.address || null,
        sourceId: input.sourceId || null,
        status: input.status,
        ownerUserId,
        createdBy: session.userId,
      },
    });

    for (const contact of input.contacts) {
      await tx.contact.create({
        data: {
          companyId: session.companyId,
          customerId: customer.id,
          name: contact.name,
          position: contact.position || null,
          phone: contact.phone || null,
          email: contact.email || null,
          isPrimary: contact.isPrimary,
        },
      });
    }

    for (const tagName of input.tags) {
      const tag = await tx.tag.upsert({
        where: { companyId_name: { companyId: session.companyId, name: tagName } },
        update: {},
        create: { companyId: session.companyId, name: tagName },
      });
      await tx.customerTag.create({ data: { customerId: customer.id, tagId: tag.id } });
    }

    await writeAuditLog(tx, {
      companyId: session.companyId,
      userId: session.userId,
      action: "CREATE",
      entityType: "customer",
      entityId: customer.id,
    });

    return { ok: true as const, data: { id: customer.id } };
  });
}

export async function updateCustomer(
  session: TenantSession,
  id: string,
  input: CustomerInput,
): Promise<ServiceResult<{ id: string }>> {
  const scope = getRequiredScope(session.role, "customer", "edit");
  if (!scope) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.customer.findFirst({
      where: { id, deletedAt: null },
      include: { contacts: { where: { deletedAt: null } }, tags: { include: { tag: true } } },
    });
    if (!existing) return notFound();
    if (scope === "own" && existing.ownerUserId !== session.userId) return forbidden();

    const ownerUserId = scope === "own" ? existing.ownerUserId : input.ownerUserId ?? existing.ownerUserId;

    const before = {
      title: existing.title,
      status: existing.status,
      type: existing.type,
      ownerUserId: existing.ownerUserId,
    };
    const after = { title: input.title, status: input.status, type: input.type, ownerUserId };

    await tx.customer.update({
      where: { id },
      data: {
        type: input.type,
        title: input.title,
        taxOffice: input.taxOffice || null,
        taxNumber: input.taxNumber || null,
        address: input.address || null,
        sourceId: input.sourceId || null,
        status: input.status,
        ownerUserId,
        updatedBy: session.userId,
      },
    });

    // Kişiler (contacts): id'si gönderilenler güncellenir, id'siz olanlar eklenir,
    // mevcutta olup gönderilmeyenler yumuşak silinir (IG-07).
    const submittedIds = new Set(input.contacts.filter((c) => c.id).map((c) => c.id));
    for (const oldContact of existing.contacts) {
      if (!submittedIds.has(oldContact.id)) {
        await tx.contact.update({ where: { id: oldContact.id }, data: { deletedAt: new Date() } });
      }
    }
    for (const contact of input.contacts) {
      const data = {
        name: contact.name,
        position: contact.position || null,
        phone: contact.phone || null,
        email: contact.email || null,
        isPrimary: contact.isPrimary,
      };
      if (contact.id) {
        await tx.contact.update({ where: { id: contact.id }, data });
      } else {
        await tx.contact.create({ data: { ...data, companyId: session.companyId, customerId: id } });
      }
    }

    // Etiketler (tags): set farkı — eklenenler oluşturulur, çıkarılanlar bağlantısı silinir.
    const existingTagNames = new Set(existing.tags.map((t) => t.tag.name));
    const newTagNames = new Set(input.tags);
    for (const tagRow of existing.tags) {
      if (!newTagNames.has(tagRow.tag.name)) {
        await tx.customerTag.delete({ where: { customerId_tagId: { customerId: id, tagId: tagRow.tagId } } });
      }
    }
    for (const tagName of input.tags) {
      if (!existingTagNames.has(tagName)) {
        const tag = await tx.tag.upsert({
          where: { companyId_name: { companyId: session.companyId, name: tagName } },
          update: {},
          create: { companyId: session.companyId, name: tagName },
        });
        await tx.customerTag.create({ data: { customerId: id, tagId: tag.id } });
      }
    }

    await writeAuditLog(tx, {
      companyId: session.companyId,
      userId: session.userId,
      action: "UPDATE",
      entityType: "customer",
      entityId: id,
      changes: diffFields(before, after),
    });

    return { ok: true as const, data: { id } };
  });
}

/** MC-14: yumuşak silme; bağlı teklif/sipariş varsa engellenir (pasife alma önerilir). */
export async function deleteCustomer(session: TenantSession, id: string): Promise<ServiceResult<{ id: string }>> {
  const scope = getRequiredScope(session.role, "customer", "delete");
  if (!scope) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.customer.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return notFound();
    if (scope === "own" && existing.ownerUserId !== session.userId) return forbidden();

    if (await hasLinkedDocuments(tx, id)) {
      return conflict("Bu müşteriye bağlı teklif/sipariş olduğu için silinemez. Pasife almayı deneyin.");
    }

    await tx.customer.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: session.userId } });

    await writeAuditLog(tx, {
      companyId: session.companyId,
      userId: session.userId,
      action: "DELETE",
      entityType: "customer",
      entityId: id,
    });

    return { ok: true as const, data: { id } };
  });
}

/** MC-07/MC-08: Görüşme kaydı + hatırlatma. */
export async function createActivity(
  session: TenantSession,
  customerId: string,
  input: ActivityInput,
): Promise<ServiceResult<{ id: string }>> {
  const scope = getRequiredScope(session.role, "customer", "edit"); // görüşme eklemek düzenleme yetkisi gerektirir
  if (!scope) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const customer = await tx.customer.findFirst({ where: { id: customerId, deletedAt: null } });
    if (!customer) return notFound();
    if (scope === "own" && customer.ownerUserId !== session.userId) return forbidden();

    const activity = await tx.activity.create({
      data: {
        companyId: session.companyId,
        customerId,
        contactId: input.contactId || null,
        type: input.type,
        occurredAt: input.occurredAt,
        note: input.note || null,
        nextAction: input.nextAction || null,
        remindAt: input.remindAt || null,
        createdBy: session.userId,
      },
    });

    await writeAuditLog(tx, {
      companyId: session.companyId,
      userId: session.userId,
      action: "CREATE",
      entityType: "activity",
      entityId: activity.id,
    });

    return { ok: true as const, data: { id: activity.id } };
  });
}
