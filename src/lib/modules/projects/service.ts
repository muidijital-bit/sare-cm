import { Prisma } from "@prisma/client";
import { withTenant } from "@/lib/db/tenant-context";
import { writeAuditLog } from "@/lib/audit/log";
import { getScope } from "@/lib/auth/access";
import type { TenantSession } from "@/lib/auth/session";
import type { ProjectInput, ProjectLaborInput, ProjectMaterialInput } from "@/lib/validation/project";
import { nextDocumentNumber } from "@/lib/modules/documents/number-sequence";
import { applyStockDeltas } from "@/lib/modules/orders/stock";
import { type ServiceResult, forbidden, notFound, conflict } from "@/lib/modules/result";

const { Decimal } = Prisma;

/**
 * Projeler (iş/inşaat takibi). Tasarım: mevcut modüller YENİDEN KULLANILIR, iş iki kez kaydedilmez —
 * - Gelir/alacak/tahsilat: projeye bağlı SİPARİŞLER (hakediş/fatura) — ödeme-mahsup mekanizması aynen.
 * - Malzeme: stok defterine PROJECT_CONSUMED hareketi (stoktan düşer, kayıt silinince geri gelir).
 * - Gider: mevcut Giderler kaydı + projectId.
 * - İşçilik: projeye özel kayıt (saat × saatlik maliyet).
 *
 * Kapsam: SALES "own" → yalnızca ownerUserId kendisi olan projeler (sipariş ile aynı desen).
 */

interface ListParams {
  q?: string;
  status?: string;
  customerId?: string;
  page: number;
  pageSize: number;
}

function assertOwn(scope: string | null, ownerUserId: string, session: TenantSession): boolean {
  return scope === "all" || (scope === "own" && ownerUserId === session.userId);
}

export async function listProjects(session: TenantSession, params: ListParams) {
  const scope = getScope(session, "project", "view");
  if (!scope) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const where: Prisma.ProjectWhereInput = {
      deletedAt: null,
      ...(scope === "own" ? { ownerUserId: session.userId } : {}),
      ...(params.status ? { status: params.status as Prisma.EnumProjectStatusFilter["equals"] } : {}),
      ...(params.customerId ? { customerId: params.customerId } : {}),
      ...(params.q
        ? {
            OR: [
              { name: { contains: params.q, mode: "insensitive" } },
              { number: { contains: params.q, mode: "insensitive" } },
              { location: { contains: params.q, mode: "insensitive" } },
              { customer: { title: { contains: params.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      tx.project.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: { customer: { select: { id: true, title: true } } },
      }),
      tx.project.count({ where }),
    ]);
    return { ok: true as const, data: { items, total, page: params.page, pageSize: params.pageSize } };
  });
}

export interface ProjectSummary {
  contractAmount: number;
  /** Bağlı (iptal edilmemiş) siparişlerin KDV hariç toplamı. */
  billed: number;
  /** Sözleşme − faturalanan (negatifse ek iş faturalanmış). */
  remainingToBill: number;
  /** Bağlı siparişlere mahsup edilmiş (iptal edilmemiş) tahsilatlar. */
  collected: number;
  materialCost: number;
  laborCost: number;
  expenseCost: number;
  /** Bağlı siparişlerdeki ürün satırlarının maliyeti (malzeme siparişle faturalandıysa). */
  orderLineCost: number;
  totalCost: number;
  profit: number;
  /** Faturalanan > 0 ise kâr / faturalanan (%). */
  marginPct: number | null;
  totalHours: number;
}

const DETAIL_INCLUDE = {
  customer: { select: { id: true, title: true } },
  materials: {
    orderBy: { usedAt: "desc" },
    include: { product: { select: { id: true, name: true, unit: true } } },
  },
  labors: {
    orderBy: { workDate: "desc" },
    include: { employee: { select: { id: true, fullName: true } } },
  },
  orders: {
    where: { deletedAt: null },
    orderBy: { orderDate: "desc" },
    select: {
      id: true,
      number: true,
      orderDate: true,
      status: true,
      grandTotal: true,
      vatTotal: true,
      items: { select: { quantity: true, unitCost: true } },
      paymentAllocations: { select: { amount: true, payment: { select: { isCancelled: true } } } },
    },
  },
  expenses: {
    where: { deletedAt: null, isRecurringTemplate: false },
    orderBy: { spentAt: "desc" },
    select: { id: true, spentAt: true, amount: true, vendor: true, note: true, category: { select: { name: true } } },
  },
} satisfies Prisma.ProjectInclude;

export type ProjectDetail = Prisma.ProjectGetPayload<{ include: typeof DETAIL_INCLUDE }>;

export function computeProjectSummary(p: ProjectDetail): ProjectSummary {
  const liveOrders = p.orders.filter((o) => o.status !== "CANCELLED");
  const billed = liveOrders.reduce((s, o) => s + Number(o.grandTotal) - Number(o.vatTotal), 0);
  const collected = liveOrders.reduce(
    (s, o) => s + o.paymentAllocations.filter((a) => !a.payment.isCancelled).reduce((t, a) => t + Number(a.amount), 0),
    0,
  );
  const orderLineCost = liveOrders.reduce(
    (s, o) => s + o.items.reduce((t, it) => t + (it.unitCost != null ? Number(it.unitCost) * Number(it.quantity) : 0), 0),
    0,
  );
  const materialCost = p.materials.reduce((s, m) => s + Number(m.unitCost) * Number(m.quantity), 0);
  const laborCost = p.labors.reduce((s, l) => s + Number(l.hourlyCost) * Number(l.hours), 0);
  const totalHours = p.labors.reduce((s, l) => s + Number(l.hours), 0);
  // Giderler: dashboard ile tutarlı olarak brüt tutar (amount) kullanılır.
  const expenseCost = p.expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalCost = materialCost + laborCost + expenseCost + orderLineCost;
  const contractAmount = Number(p.contractAmount);
  const profit = billed - totalCost;
  return {
    contractAmount,
    billed,
    remainingToBill: contractAmount - billed,
    collected,
    materialCost,
    laborCost,
    expenseCost,
    orderLineCost,
    totalCost,
    profit,
    marginPct: billed > 0 ? (profit / billed) * 100 : null,
    totalHours,
  };
}

export async function getProject(session: TenantSession, id: string): Promise<ServiceResult<{ project: ProjectDetail; summary: ProjectSummary }>> {
  const scope = getScope(session, "project", "view");
  if (!scope) return forbidden();
  return withTenant(session.companyId, async (tx) => {
    const project = await tx.project.findFirst({ where: { id, deletedAt: null }, include: DETAIL_INCLUDE });
    if (!project) return notFound();
    if (!assertOwn(scope, project.ownerUserId, session)) return forbidden();
    return { ok: true as const, data: { project, summary: computeProjectSummary(project) } };
  });
}

/**
 * Sipariş/gider formlarındaki "Proje" seçimi için — açık (planlandı/devam eden) projeler. `includeId`
 * (düzenlenen kaydın mevcut projesi) durumundan bağımsız eklenir; yoksa kapanmış projeye bağlı bir
 * kayıt düzenlenip kaydedilince bağ sessizce kopardı.
 */
export async function listProjectOptions(session: TenantSession, includeId?: string | null) {
  const scope = getScope(session, "project", "view");
  if (!scope) return [];
  return withTenant(session.companyId, (tx) =>
    tx.project.findMany({
      where: {
        deletedAt: null,
        OR: [{ status: { in: ["PLANNED", "IN_PROGRESS"] } }, ...(includeId ? [{ id: includeId }] : [])],
        ...(scope === "own" ? { ownerUserId: session.userId } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, number: true, name: true, customerId: true },
      take: 200,
    }),
  );
}

function projectData(input: ProjectInput) {
  return {
    name: input.name,
    customerId: input.customerId,
    status: input.status,
    location: input.location || null,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    contractAmount: new Decimal(input.contractAmount),
    note: input.note || null,
  };
}

export async function createProject(session: TenantSession, input: ProjectInput): Promise<ServiceResult<{ id: string }>> {
  if (!getScope(session, "project", "create")) return forbidden();
  return withTenant(session.companyId, async (tx) => {
    const customer = await tx.customer.findFirst({ where: { id: input.customerId, deletedAt: null } });
    if (!customer) return notFound("Müşteri bulunamadı.");

    const company = await tx.company.findUniqueOrThrow({ where: { id: session.companyId } });
    const number = await nextDocumentNumber(tx, session.companyId, "PROJECT", company.projectNumberFormat);

    const project = await tx.project.create({
      data: { companyId: session.companyId, number, ...projectData(input), ownerUserId: session.userId, createdBy: session.userId },
    });
    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "CREATE", entityType: "project", entityId: project.id });
    return { ok: true as const, data: { id: project.id } };
  });
}

export async function updateProject(session: TenantSession, id: string, input: ProjectInput): Promise<ServiceResult<{ id: string }>> {
  const scope = getScope(session, "project", "edit");
  if (!scope) return forbidden();
  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.project.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return notFound();
    if (!assertOwn(scope, existing.ownerUserId, session)) return forbidden();
    if (input.customerId !== existing.customerId) {
      const linked = await tx.order.count({ where: { projectId: id, deletedAt: null } });
      if (linked > 0) return conflict("Projeye bağlı sipariş varken müşteri değiştirilemez.");
      const customer = await tx.customer.findFirst({ where: { id: input.customerId, deletedAt: null } });
      if (!customer) return notFound("Müşteri bulunamadı.");
    }
    await tx.project.update({ where: { id }, data: { ...projectData(input), updatedBy: session.userId } });
    await writeAuditLog(tx, {
      companyId: session.companyId,
      userId: session.userId,
      action: "UPDATE",
      entityType: "project",
      entityId: id,
      ...(existing.status !== input.status ? { changes: { status: { eski: existing.status, yeni: input.status } } } : {}),
    });
    return { ok: true as const, data: { id } };
  });
}

/**
 * Silme (yumuşak): kullanılan malzemeler stoğa GERİ EKLENİR, bağlı sipariş/giderlerin proje bağı
 * kaldırılır (kayıtlar silinmez — mali kayıttır). Bağlı sipariş varken silmeye izin verilmez; önce
 * siparişlerin bağı kaldırılmalı/iptal edilmeli (yanlışlıkla gelir kaybı olmasın).
 */
export async function deleteProject(session: TenantSession, id: string): Promise<ServiceResult<{ id: string }>> {
  if (!getScope(session, "project", "delete")) return forbidden();
  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.project.findFirst({ where: { id, deletedAt: null }, include: { materials: true } });
    if (!existing) return notFound();
    const linkedOrders = await tx.order.count({ where: { projectId: id, deletedAt: null, status: { not: "CANCELLED" } } });
    if (linkedOrders > 0) return conflict("Projeye bağlı aktif sipariş var; önce siparişleri iptal edin veya projeden ayırın.");

    for (const m of existing.materials) await reverseMaterialStock(tx, session, m.id);
    await tx.projectMaterial.deleteMany({ where: { projectId: id } });
    await tx.expense.updateMany({ where: { projectId: id }, data: { projectId: null } });
    await tx.project.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: session.userId } });
    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "DELETE", entityType: "project", entityId: id });
    return { ok: true as const, data: { id } };
  });
}

async function loadEditableProject(tx: Prisma.TransactionClient, session: TenantSession, projectId: string) {
  const scope = getScope(session, "project", "edit");
  if (!scope) return { error: forbidden() };
  const project = await tx.project.findFirst({ where: { id: projectId, deletedAt: null } });
  if (!project) return { error: notFound() };
  if (!assertOwn(scope, project.ownerUserId, session)) return { error: forbidden() };
  if (project.status === "CANCELLED") return { error: conflict("İptal edilmiş projeye kayıt eklenemez.") };
  return { project };
}

/** Malzeme kullanımı: stoktan düşer; birim maliyet verilmezse ürünün güncel maliyeti (yoksa 0). */
export async function addProjectMaterial(session: TenantSession, projectId: string, input: ProjectMaterialInput): Promise<ServiceResult<{ id: string }>> {
  return withTenant(session.companyId, async (tx) => {
    const loaded = await loadEditableProject(tx, session, projectId);
    if (loaded.error) return loaded.error;
    const product = await tx.product.findFirst({ where: { id: input.productId, deletedAt: null } });
    if (!product) return notFound("Ürün bulunamadı.");

    const unitCost = input.unitCost != null ? new Decimal(input.unitCost) : product.defaultCost ?? new Decimal(0);
    const material = await tx.projectMaterial.create({
      data: {
        companyId: session.companyId,
        projectId,
        productId: input.productId,
        quantity: new Decimal(input.quantity),
        unitCost,
        usedAt: input.usedAt,
        note: input.note || null,
        createdBy: session.userId,
      },
    });
    await applyStockDeltas(tx, {
      companyId: session.companyId,
      deltas: [{ productId: input.productId, delta: new Decimal(input.quantity).negated() }],
      type: "PROJECT_CONSUMED",
      createdBy: session.userId,
      projectMaterialId: material.id,
      note: `${loaded.project.number} · ${loaded.project.name}`,
    });
    await writeAuditLog(tx, {
      companyId: session.companyId,
      userId: session.userId,
      action: "UPDATE",
      entityType: "project",
      entityId: projectId,
      changes: { malzeme: { eski: null, yeni: `${product.name} × ${input.quantity}` } },
    });
    return { ok: true as const, data: { id: material.id } };
  });
}

/** Bir malzeme kaydının stok etkisini tersine çevirir (kaydın net hareketi kadar). */
async function reverseMaterialStock(tx: Prisma.TransactionClient, session: TenantSession, materialId: string) {
  const rows = await tx.stockMovement.groupBy({ by: ["productId"], where: { projectMaterialId: materialId }, _sum: { quantity: true } });
  const deltas = rows.map((r) => ({ productId: r.productId, delta: (r._sum.quantity ?? new Decimal(0)).negated() }));
  await applyStockDeltas(tx, {
    companyId: session.companyId,
    deltas,
    type: "ADJUSTMENT",
    createdBy: session.userId,
    projectMaterialId: materialId,
    note: "Proje malzeme kaydı silindi",
  });
}

export async function deleteProjectMaterial(session: TenantSession, projectId: string, materialId: string): Promise<ServiceResult<{ id: string }>> {
  return withTenant(session.companyId, async (tx) => {
    const loaded = await loadEditableProject(tx, session, projectId);
    if (loaded.error) return loaded.error;
    const material = await tx.projectMaterial.findFirst({ where: { id: materialId, projectId }, include: { product: { select: { name: true } } } });
    if (!material) return notFound();

    await reverseMaterialStock(tx, session, materialId);
    await tx.stockMovement.updateMany({ where: { projectMaterialId: materialId }, data: { projectMaterialId: null } });
    await tx.projectMaterial.delete({ where: { id: materialId } });
    await writeAuditLog(tx, {
      companyId: session.companyId,
      userId: session.userId,
      action: "UPDATE",
      entityType: "project",
      entityId: projectId,
      changes: { malzeme: { eski: `${material.product.name} × ${material.quantity.toString()}`, yeni: null } },
    });
    return { ok: true as const, data: { id: materialId } };
  });
}

export async function addProjectLabor(session: TenantSession, projectId: string, input: ProjectLaborInput): Promise<ServiceResult<{ id: string }>> {
  return withTenant(session.companyId, async (tx) => {
    const loaded = await loadEditableProject(tx, session, projectId);
    if (loaded.error) return loaded.error;
    if (input.employeeId) {
      const employee = await tx.employee.findFirst({ where: { id: input.employeeId, deletedAt: null } });
      if (!employee) return notFound("Personel bulunamadı.");
    }
    const labor = await tx.projectLabor.create({
      data: {
        companyId: session.companyId,
        projectId,
        employeeId: input.employeeId ?? null,
        description: input.description,
        workDate: input.workDate,
        hours: new Decimal(input.hours),
        hourlyCost: new Decimal(input.hourlyCost),
        createdBy: session.userId,
      },
    });
    await writeAuditLog(tx, {
      companyId: session.companyId,
      userId: session.userId,
      action: "UPDATE",
      entityType: "project",
      entityId: projectId,
      changes: { iscilik: { eski: null, yeni: `${input.description} · ${input.hours} saat` } },
    });
    return { ok: true as const, data: { id: labor.id } };
  });
}

export async function deleteProjectLabor(session: TenantSession, projectId: string, laborId: string): Promise<ServiceResult<{ id: string }>> {
  return withTenant(session.companyId, async (tx) => {
    const loaded = await loadEditableProject(tx, session, projectId);
    if (loaded.error) return loaded.error;
    const labor = await tx.projectLabor.findFirst({ where: { id: laborId, projectId } });
    if (!labor) return notFound();
    await tx.projectLabor.delete({ where: { id: laborId } });
    await writeAuditLog(tx, {
      companyId: session.companyId,
      userId: session.userId,
      action: "UPDATE",
      entityType: "project",
      entityId: projectId,
      changes: { iscilik: { eski: `${labor.description} · ${labor.hours.toString()} saat`, yeni: null } },
    });
    return { ok: true as const, data: { id: laborId } };
  });
}
