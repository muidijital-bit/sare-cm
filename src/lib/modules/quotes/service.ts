import type { Prisma } from "@prisma/client";
import { withTenant } from "@/lib/db/tenant-context";
import { writeAuditLog, diffFields } from "@/lib/audit/log";
import { getRequiredScope } from "@/lib/auth/rbac";
import type { TenantSession } from "@/lib/auth/session";
import type { QuoteInput } from "@/lib/validation/quote";
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

/**
 * TK-07: Süresi geçen teklifler otomatik "süresi doldu" durumuna geçer. V1'de ayrı bir
 * zamanlanmış görev (cron) altyapısı olmadığından bu, her okuma (liste/detay) sırasında
 * "lazy" olarak uygulanır — süresi geçmiş `SENT` teklifler görülmeden hemen önce EXPIRED'a
 * çevrilir. Kullanıcı ilk kez bakana kadar veritabanında geçici olarak "gecikmiş SENT"
 * durumda kalabilir; bu V1 için kabul edilebilir bir basitleştirmedir.
 */
async function expireStaleQuotes(tx: Prisma.TransactionClient, companyId: string): Promise<void> {
  await tx.quote.updateMany({
    where: { companyId, status: "SENT", validUntil: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
}

function toLineInputs(items: QuoteInput["items"]): LineInput[] {
  return items.map((i) => ({
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    discountType: i.discountType,
    discountValue: i.discountValue,
    vatRate: i.vatRate,
  }));
}

export async function listQuotes(session: TenantSession, params: ListParams) {
  const scope = getRequiredScope(session.role, "quote", "view");
  if (!scope) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    await expireStaleQuotes(tx, session.companyId);

    const where: Prisma.QuoteWhereInput = {
      deletedAt: null,
      ...(scope === "own" ? { ownerUserId: session.userId } : params.ownerUserId ? { ownerUserId: params.ownerUserId } : {}),
      ...(params.status ? { status: params.status as Prisma.EnumQuoteStatusFilter["equals"] } : {}),
      ...(params.customerId ? { customerId: params.customerId } : {}),
      ...(params.q
        ? { OR: [{ number: { contains: params.q, mode: "insensitive" } }, { customer: { title: { contains: params.q, mode: "insensitive" } } }] }
        : {}),
    };

    const [items, total] = await Promise.all([
      tx.quote.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: { customer: { select: { title: true } } },
      }),
      tx.quote.count({ where }),
    ]);

    return { ok: true as const, data: { items, total, page: params.page, pageSize: params.pageSize } };
  });
}

const QUOTE_DETAIL_INCLUDE = {
  customer: { select: { id: true, title: true, ownerUserId: true } },
  contact: { select: { id: true, name: true } },
  items: { include: { product: { select: { name: true } } }, orderBy: { sortOrder: "asc" } },
  parentQuote: { select: { id: true, number: true } },
  revisions: { select: { id: true, number: true, status: true, createdAt: true }, orderBy: { createdAt: "asc" } },
  orders: { select: { id: true, number: true, status: true } },
} satisfies Prisma.QuoteInclude;

export type QuoteDetail = Prisma.QuoteGetPayload<{ include: typeof QUOTE_DETAIL_INCLUDE }>;

export async function getQuote(session: TenantSession, id: string): Promise<ServiceResult<QuoteDetail>> {
  const scope = getRequiredScope(session.role, "quote", "view");
  if (!scope) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    await expireStaleQuotes(tx, session.companyId);

    const quote = await tx.quote.findFirst({ where: { id, deletedAt: null }, include: QUOTE_DETAIL_INCLUDE });
    if (!quote) return notFound();
    if (scope === "own" && quote.ownerUserId !== session.userId) return forbidden();

    return { ok: true as const, data: quote };
  });
}

export async function createQuote(session: TenantSession, input: QuoteInput): Promise<ServiceResult<{ id: string }>> {
  const scope = getRequiredScope(session.role, "quote", "create");
  if (!scope) return forbidden();

  const ownerUserId = scope === "own" ? session.userId : input.ownerUserId ?? session.userId;
  const { lines, totals } = calculateDocument(toLineInputs(input.items), input.documentDiscount ?? undefined);

  return withTenant(session.companyId, async (tx) => {
    const customer = await tx.customer.findFirst({ where: { id: input.customerId, deletedAt: null } });
    if (!customer) return notFound("Müşteri bulunamadı.");

    const company = await tx.company.findUniqueOrThrow({ where: { id: session.companyId } });
    const number = await nextDocumentNumber(tx, session.companyId, "QUOTE", company.quoteNumberFormat);

    const quote = await tx.quote.create({
      data: {
        companyId: session.companyId,
        number,
        customerId: input.customerId,
        contactId: input.contactId || null,
        status: "DRAFT",
        issueDate: input.issueDate,
        validUntil: input.validUntil,
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

    await tx.quoteItem.createMany({
      data: input.items.map((item, i) => ({
        quoteId: quote.id,
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

    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "CREATE", entityType: "quote", entityId: quote.id });

    return { ok: true as const, data: { id: quote.id } };
  });
}

export async function updateQuote(session: TenantSession, id: string, input: QuoteInput): Promise<ServiceResult<{ id: string }>> {
  const scope = getRequiredScope(session.role, "quote", "edit");
  if (!scope) return forbidden();

  const { lines, totals } = calculateDocument(toLineInputs(input.items), input.documentDiscount ?? undefined);

  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.quote.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return notFound();
    if (scope === "own" && existing.ownerUserId !== session.userId) return forbidden();
    // TK-10: Gönderilmiş teklif düzenlenemez; düzenleme için revizyon açılır.
    if (existing.status !== "DRAFT") {
      return conflict("Yalnızca taslak durumundaki teklifler düzenlenebilir. Değişiklik için revizyon oluşturun.");
    }

    const ownerUserId = scope === "own" ? existing.ownerUserId : input.ownerUserId ?? existing.ownerUserId;

    await tx.quote.update({
      where: { id },
      data: {
        customerId: input.customerId,
        contactId: input.contactId || null,
        issueDate: input.issueDate,
        validUntil: input.validUntil,
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

    await tx.quoteItem.deleteMany({ where: { quoteId: id } });
    await tx.quoteItem.createMany({
      data: input.items.map((item, i) => ({
        quoteId: id,
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

    await writeAuditLog(tx, {
      companyId: session.companyId,
      userId: session.userId,
      action: "UPDATE",
      entityType: "quote",
      entityId: id,
      changes: diffFields({ grandTotal: existing.grandTotal.toString() }, { grandTotal: totals.grandTotal.toString() }),
    });

    return { ok: true as const, data: { id } };
  });
}

async function transitionStatus(
  session: TenantSession,
  id: string,
  allowedFrom: Array<"DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED">,
  to: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED",
): Promise<ServiceResult<{ id: string; status: string }>> {
  const scope = getRequiredScope(session.role, "quote", "edit");
  if (!scope) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.quote.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return notFound();
    if (scope === "own" && existing.ownerUserId !== session.userId) return forbidden();
    if (!allowedFrom.includes(existing.status)) {
      return conflict(`Bu işlem "${existing.status}" durumundaki bir teklif için yapılamaz.`);
    }

    await tx.quote.update({ where: { id }, data: { status: to, updatedBy: session.userId } });
    await writeAuditLog(tx, {
      companyId: session.companyId,
      userId: session.userId,
      action: "UPDATE",
      entityType: "quote",
      entityId: id,
      changes: { status: { eski: existing.status, yeni: to } },
    });

    return { ok: true as const, data: { id, status: to } };
  });
}

/**
 * Yalnızca TASLAK teklifler silinebilir — gönderilmiş/kabul edilmiş bir teklif işlem
 * geçmişinin ve (varsa) sipariş bağlantısının bir parçasıdır, silinmez (bkz. §6 durum
 * makinesi). Diğer durumlar için "sil" yerine ilgili geçiş (red/süre doldu) kullanılır.
 */
export async function deleteQuote(session: TenantSession, id: string): Promise<ServiceResult<{ id: string }>> {
  const scope = getRequiredScope(session.role, "quote", "delete");
  if (!scope) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.quote.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return notFound();
    if (scope === "own" && existing.ownerUserId !== session.userId) return forbidden();
    if (existing.status !== "DRAFT") return conflict("Yalnızca taslak teklifler silinebilir.");

    await tx.quote.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "DELETE", entityType: "quote", entityId: id });

    return { ok: true as const, data: { id } };
  });
}

/** Toplu silme — her kayıt için tek tek deleteQuote() iş kurallarını uygular, sonucu özetler. */
export async function bulkDeleteQuotes(
  session: TenantSession,
  ids: string[],
): Promise<{ succeeded: string[]; failed: { id: string; message: string }[] }> {
  const succeeded: string[] = [];
  const failed: { id: string; message: string }[] = [];
  for (const id of ids) {
    const res = await deleteQuote(session, id);
    if (res.ok) succeeded.push(id);
    else failed.push({ id, message: res.message });
  }
  return { succeeded, failed };
}

/** TK-06: taslak → gönderildi */
export const sendQuote = (session: TenantSession, id: string) => transitionStatus(session, id, ["DRAFT"], "SENT");
/** TK-06: gönderildi → kabul */
export const acceptQuote = (session: TenantSession, id: string) => transitionStatus(session, id, ["SENT"], "ACCEPTED");
/** TK-06: gönderildi → red */
export const rejectQuote = (session: TenantSession, id: string) => transitionStatus(session, id, ["SENT"], "REJECTED");

/** TK-09: mevcut teklifin kopyası (yeni bir taslak) — ilişki `parentQuoteId` ile korunur. */
export async function createRevision(session: TenantSession, id: string): Promise<ServiceResult<{ id: string }>> {
  const scope = getRequiredScope(session.role, "quote", "edit");
  if (!scope) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const source = await tx.quote.findFirst({ where: { id, deletedAt: null }, include: { items: true } });
    if (!source) return notFound();
    if (scope === "own" && source.ownerUserId !== session.userId) return forbidden();
    if (source.status === "DRAFT") return conflict("Taslak teklif zaten düzenlenebilir, revizyon gerekmez.");

    const baseNumber = source.number.replace(/-R\d+$/, "");
    const nextRevision = source.revisionNumber + 1;

    const revision = await tx.quote.create({
      data: {
        companyId: session.companyId,
        number: `${baseNumber}-R${nextRevision}`,
        customerId: source.customerId,
        contactId: source.contactId,
        status: "DRAFT",
        issueDate: new Date(),
        validUntil: source.validUntil,
        documentDiscountType: source.documentDiscountType,
        documentDiscountValue: source.documentDiscountValue,
        subtotal: source.subtotal,
        discountTotal: source.discountTotal,
        vatTotal: source.vatTotal,
        grandTotal: source.grandTotal,
        parentQuoteId: source.id,
        revisionNumber: nextRevision,
        ownerUserId: source.ownerUserId,
        note: source.note,
        createdBy: session.userId,
      },
    });

    await tx.quoteItem.createMany({
      data: source.items.map((item, i) => ({
        quoteId: revision.id,
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
      entityType: "quote",
      entityId: revision.id,
      changes: { revisionOf: { eski: null, yeni: source.id } },
    });

    return { ok: true as const, data: { id: revision.id } };
  });
}
