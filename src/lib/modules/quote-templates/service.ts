import type { Prisma, QuoteWorkbookKind } from "@prisma/client";
import { withTenant } from "@/lib/db/tenant-context";
import { writeAuditLog } from "@/lib/audit/log";
import { getScope } from "@/lib/auth/access";
import type { TenantSession } from "@/lib/auth/session";
import { createQuote } from "@/lib/modules/quotes/service";
import { type ServiceResult, forbidden, notFound, conflict } from "@/lib/modules/result";
import { workbookContentSchema, type WorkbookContent, type WorkbookInput } from "./types";
import { sheetTotals, workbookTotal } from "./calc";

/**
 * Teklif şablonları + şablondan hazırlanan teklif belgeleri (quote_workbooks).
 *
 * Yetki (Teklifler modülüne bağlı, ayrı lisans yok):
 * - Görüntüleme: teklif görüntüleme yetkisi.
 * - ŞABLON oluşturma/düzenleme/silme: teklif oluşturma kapsamı "all" olanlar (Sahip/Yönetici) —
 *   şablon şirket genelidir, satış temsilcisi kendi şablonunu değil şirketinkini kullanır.
 * - Şablondan TEKLİF hazırlama: teklif oluşturma yetkisi; satış ("own") yalnızca kendi belgelerini görür.
 */
export function canManageTemplates(session: TenantSession): boolean {
  return getScope(session, "quote", "create") === "all";
}

function scopeWhere(session: TenantSession, kind: QuoteWorkbookKind): Prisma.QuoteWorkbookWhereInput {
  const scope = getScope(session, "quote", "view");
  return { deletedAt: null, kind, ...(kind === "QUOTE" && scope === "own" ? { ownerUserId: session.userId } : {}) };
}

export interface WorkbookRow {
  id: string;
  name: string;
  description: string | null;
  customerTitle: string | null;
  sheetCount: number;
  total: number;
  convertedQuoteId: string | null;
  quoteNo: string;
  updatedAt: Date;
}

export async function listWorkbooks(session: TenantSession, kind: QuoteWorkbookKind, q?: string): Promise<ServiceResult<WorkbookRow[]>> {
  if (!getScope(session, "quote", "view")) return forbidden();
  return withTenant(session.companyId, async (tx) => {
    const rows = await tx.quoteWorkbook.findMany({
      where: {
        ...scopeWhere(session, kind),
        ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { customer: { title: { contains: q, mode: "insensitive" } } }] } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
      include: { customer: { select: { title: true } } },
    });
    return {
      ok: true as const,
      data: rows.map((r) => {
        const content = workbookContentSchema.parse(r.content);
        return {
          id: r.id,
          name: r.name,
          description: r.description,
          customerTitle: r.customer?.title ?? null,
          sheetCount: content.sheets.length,
          total: workbookTotal(content),
          convertedQuoteId: r.convertedQuoteId,
          quoteNo: content.customer.quoteNo,
          updatedAt: r.updatedAt,
        };
      }),
    };
  });
}

export interface WorkbookDetail {
  id: string;
  kind: QuoteWorkbookKind;
  name: string;
  description: string | null;
  customerId: string | null;
  sourceTemplateId: string | null;
  convertedQuoteId: string | null;
  content: WorkbookContent;
  updatedAt: Date;
}

export async function getWorkbook(session: TenantSession, id: string): Promise<ServiceResult<WorkbookDetail>> {
  if (!getScope(session, "quote", "view")) return forbidden();
  return withTenant(session.companyId, async (tx) => {
    const r = await tx.quoteWorkbook.findFirst({ where: { id, deletedAt: null } });
    if (!r) return notFound();
    if (r.kind === "QUOTE" && getScope(session, "quote", "view") === "own" && r.ownerUserId !== session.userId) return forbidden();
    return {
      ok: true as const,
      data: {
        id: r.id,
        kind: r.kind,
        name: r.name,
        description: r.description,
        customerId: r.customerId,
        sourceTemplateId: r.sourceTemplateId,
        convertedQuoteId: r.convertedQuoteId,
        content: workbookContentSchema.parse(r.content),
        updatedAt: r.updatedAt,
      },
    };
  });
}

function canWrite(session: TenantSession, kind: QuoteWorkbookKind, ownerUserId?: string): boolean {
  if (kind === "TEMPLATE") return canManageTemplates(session);
  const scope = getScope(session, "quote", ownerUserId ? "edit" : "create");
  if (!scope) return false;
  return scope === "all" || !ownerUserId || ownerUserId === session.userId;
}

// İçerik JSON'u (logo + çok sayfa) yüzlerce KB olabilir; yavaş bağlantıda 15 sn'lik varsayılan aşılıyordu.
const WRITE_TX = { timeoutMs: 60_000 };

export async function createWorkbook(session: TenantSession, kind: QuoteWorkbookKind, input: WorkbookInput): Promise<ServiceResult<{ id: string }>> {
  if (!canWrite(session, kind)) return forbidden();
  return withTenant(session.companyId, async (tx) => {
    if (input.customerId && !(await tx.customer.findFirst({ where: { id: input.customerId, deletedAt: null } }))) return notFound("Müşteri bulunamadı.");
    const r = await tx.quoteWorkbook.create({
      data: {
        companyId: session.companyId,
        kind,
        name: input.name,
        description: input.description || null,
        content: input.content as Prisma.InputJsonValue,
        customerId: kind === "QUOTE" ? input.customerId ?? null : null,
        ownerUserId: session.userId,
        createdBy: session.userId,
      },
    });
    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "CREATE", entityType: "quote_workbook", entityId: r.id });
    return { ok: true as const, data: { id: r.id } };
  }, WRITE_TX);
}

export async function updateWorkbook(session: TenantSession, id: string, input: WorkbookInput): Promise<ServiceResult<{ id: string }>> {
  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.quoteWorkbook.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return notFound();
    if (!canWrite(session, existing.kind, existing.ownerUserId)) return forbidden();
    if (input.customerId && !(await tx.customer.findFirst({ where: { id: input.customerId, deletedAt: null } }))) return notFound("Müşteri bulunamadı.");
    await tx.quoteWorkbook.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description || null,
        content: input.content as Prisma.InputJsonValue,
        ...(existing.kind === "QUOTE" ? { customerId: input.customerId ?? null } : {}),
        updatedBy: session.userId,
      },
    });
    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "UPDATE", entityType: "quote_workbook", entityId: id });
    return { ok: true as const, data: { id } };
  }, WRITE_TX);
}

export async function deleteWorkbook(session: TenantSession, id: string): Promise<ServiceResult<{ id: string }>> {
  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.quoteWorkbook.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return notFound();
    if (existing.kind === "TEMPLATE" ? !canManageTemplates(session) : !getScope(session, "quote", "delete")) return forbidden();
    if (existing.kind === "QUOTE" && getScope(session, "quote", "delete") === "own" && existing.ownerUserId !== session.userId) return forbidden();
    await tx.quoteWorkbook.update({ where: { id }, data: { deletedAt: new Date(), updatedBy: session.userId } });
    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "DELETE", entityType: "quote_workbook", entityId: id });
    return { ok: true as const, data: { id } };
  });
}

/** Şablonu kopyala (yeni sürüm denemek / benzer şablon için). */
export async function duplicateTemplate(session: TenantSession, id: string): Promise<ServiceResult<{ id: string }>> {
  if (!canManageTemplates(session)) return forbidden();
  const src = await getWorkbook(session, id);
  if (!src.ok) return src;
  return createWorkbook(session, "TEMPLATE", { name: `${src.data.name} (kopya)`, description: src.data.description ?? "", content: src.data.content });
}

/**
 * Şablondan müşteriye teklif hazırla: antet/kapak/seçilen sayfalar kopyalanır, müşteri bilgileri
 * (unvan, adres, birincil kişinin telefon/e-postası) doldurulur. Şablon değişse de belge değişmez.
 */
export async function prepareQuoteFromTemplate(
  session: TenantSession,
  templateId: string,
  input: { customerId: string; sheetNames?: string[] },
): Promise<ServiceResult<{ id: string }>> {
  if (!getScope(session, "quote", "create")) return forbidden();
  const tpl = await getWorkbook(session, templateId);
  if (!tpl.ok) return tpl;
  if (tpl.data.kind !== "TEMPLATE") return conflict("Bu kayıt bir şablon değil.");

  const customer = await withTenant(session.companyId, (tx) =>
    tx.customer.findFirst({
      where: { id: input.customerId, deletedAt: null },
      include: { contacts: { where: { deletedAt: null }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], take: 1 } },
    }),
  );
  if (!customer) return notFound("Müşteri bulunamadı.");
  const contact = customer.contacts[0];

  const content: WorkbookContent = JSON.parse(JSON.stringify(tpl.data.content)); // structuredClone Node 16'da yok
  if (input.sheetNames?.length) content.sheets = content.sheets.filter((s) => input.sheetNames!.includes(s.name));
  content.customer = {
    quoteNo: "",
    date: new Date().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" }),
    name: customer.title,
    address: customer.address ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
  };

  const res = await createWorkbook(session, "QUOTE", {
    name: `${customer.title} — ${tpl.data.name}`,
    description: "",
    customerId: customer.id,
    content,
  });
  if (res.ok) {
    await withTenant(session.companyId, (tx) => tx.quoteWorkbook.update({ where: { id: res.data.id }, data: { sourceTemplateId: templateId } }));
  }
  return res;
}

/**
 * Satış teklifine dönüştür (Teklifler modülü): icmale dahil her sayfa bir satır — fiyat = sayfanın
 * satış toplamı, maliyet = sayfanın maliyeti (panodaki brüt kâr doğru hesaplansın). Teklif no belgeye yazılır.
 */
export async function convertToSalesQuote(session: TenantSession, id: string): Promise<ServiceResult<{ quoteId: string; number: string }>> {
  const wb = await getWorkbook(session, id);
  if (!wb.ok) return wb;
  if (wb.data.kind !== "QUOTE") return conflict("Yalnızca hazırlanmış teklifler dönüştürülebilir.");
  if (wb.data.convertedQuoteId) return conflict("Bu belge zaten bir satış teklifine dönüştürüldü.");
  if (!wb.data.customerId) return conflict("Önce müşteri seçin.");

  const sheets = wb.data.content.sheets.filter((s) => s.includeInSummary);
  const items = sheets
    .map((s) => ({ s, t: sheetTotals(s) }))
    .filter(({ t }) => t.total > 0)
    .map(({ s, t }) => ({
      description: s.summaryLabel || s.title || s.name,
      quantity: 1,
      unit: "takım",
      unitPrice: Math.round(t.total * 100) / 100,
      unitCost: Math.round((t.cost + (s.pricing.overheadCost || 0)) * 100) / 100,
      discountType: "PERCENT" as const,
      discountValue: 0,
      vatRate: 20,
      productId: null,
    }));
  if (items.length === 0) return conflict("İcmale dahil, tutarı olan sayfa yok.");

  const issueDate = new Date();
  const validUntil = new Date(issueDate.getTime() + 15 * 86400000);
  const created = await createQuote(session, {
    customerId: wb.data.customerId,
    contactId: null,
    issueDate,
    validUntil,
    ownerUserId: null,
    note: `Teklif şablonundan oluşturuldu: ${wb.data.name}`,
    documentDiscount: null,
    items,
  });
  if (!created.ok) return created;

  return withTenant(session.companyId, async (tx) => {
    const quote = await tx.quote.findUniqueOrThrow({ where: { id: created.data.id }, select: { number: true } });
    const content = { ...wb.data.content, customer: { ...wb.data.content.customer, quoteNo: quote.number } };
    await tx.quoteWorkbook.update({ where: { id }, data: { convertedQuoteId: created.data.id, content: content as Prisma.InputJsonValue, updatedBy: session.userId } });
    return { ok: true as const, data: { quoteId: created.data.id, number: quote.number } };
  });
}
