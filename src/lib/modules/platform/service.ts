import { withPlatformBypass } from "@/lib/db/tenant-context";
import { writeAuditLog } from "@/lib/audit/log";
import { generateSecureToken, INVITATION_TOKEN_TTL_MS } from "@/lib/security/tokens";
import type { SuperAdminSession } from "@/lib/auth/session";
import type { CreateCompanyInput, CreatePlanInput, CompanyModuleInput } from "@/lib/validation/platform";
import { computeEnabledModules } from "@/lib/modules/entitlements/resolve";
import { type ServiceResult, notFound, conflict } from "@/lib/modules/result";

/**
 * Platform (süper admin) katmanı — her zaman `withPlatformBypass` kullanır, çünkü doğası
 * gereği tek bir şirkete değil TÜM şirketlere işlem yapar. Her yazma PF-07 gereği
 * `isSuperAdminAccess: true` ile denetim kaydına düşer.
 */

export async function listPlans() {
  return withPlatformBypass((tx) => tx.plan.findMany({ where: { isActive: true }, orderBy: { price: "asc" } }));
}

export async function createPlan(session: SuperAdminSession, input: CreatePlanInput) {
  return withPlatformBypass(async (tx) => {
    const plan = await tx.plan.create({ data: input });
    await writeAuditLog(tx, { companyId: null, userId: session.userId, action: "CREATE", entityType: "plan", entityId: plan.id, isSuperAdminAccess: true });
    return plan;
  });
}

export interface CompanySummary {
  id: string;
  name: string;
  status: string;
  planName: string;
  subscriptionEndsAt: Date | null;
  memberCount: number;
  customerCount: number;
  createdAt: Date;
}

/** PF-06: şirket bazında kullanım özeti (basit sürüm — kullanıcı/müşteri sayısı, son giriş hariç). */
export async function listCompanies(): Promise<CompanySummary[]> {
  return withPlatformBypass(async (tx) => {
    const companies = await tx.company.findMany({
      where: { deletedAt: null },
      include: { plan: { select: { name: true } }, _count: { select: { memberships: true, customers: true } } },
      orderBy: { createdAt: "desc" },
    });
    return companies.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      planName: c.plan.name,
      subscriptionEndsAt: c.subscriptionEndsAt,
      memberCount: c._count.memberships,
      customerCount: c._count.customers,
      createdAt: c.createdAt,
    }));
  });
}

/** PF-01/PF-02: yeni şirket + ilk Sahip daveti (e-posta gönderimi yok — bağlantı UI'da gösterilir). */
export async function createCompany(session: SuperAdminSession, input: CreateCompanyInput): Promise<ServiceResult<{ companyId: string; inviteToken: string }>> {
  return withPlatformBypass(async (tx) => {
    const plan = await tx.plan.findFirst({ where: { id: input.planId, isActive: true } });
    if (!plan) return notFound("Paket bulunamadı.");

    const company = await tx.company.create({
      data: {
        name: input.name,
        planId: input.planId,
        status: "TRIAL",
        subscriptionEndsAt: input.subscriptionEndsAt ?? null,
      },
    });

    const inviteToken = generateSecureToken();
    await tx.invitationToken.create({
      data: {
        companyId: company.id,
        email: input.ownerEmail,
        role: "OWNER",
        token: inviteToken,
        invitedBy: session.userId,
        expiresAt: new Date(Date.now() + INVITATION_TOKEN_TTL_MS),
      },
    });

    await writeAuditLog(tx, { companyId: company.id, userId: session.userId, action: "CREATE", entityType: "company", entityId: company.id, isSuperAdminAccess: true });

    return { ok: true as const, data: { companyId: company.id, inviteToken } };
  });
}

/** PF-04: askıya alma/aktifleştirme — veri silinmez, yalnızca durum değişir. */
export async function setCompanyStatus(session: SuperAdminSession, companyId: string, status: "TRIAL" | "ACTIVE" | "SUSPENDED"): Promise<ServiceResult<{ id: string }>> {
  return withPlatformBypass(async (tx) => {
    const company = await tx.company.findFirst({ where: { id: companyId, deletedAt: null } });
    if (!company) return notFound();
    if (company.status === status) return conflict("Şirket zaten bu durumda.");

    await tx.company.update({ where: { id: companyId }, data: { status } });
    await writeAuditLog(tx, {
      companyId,
      userId: session.userId,
      action: "UPDATE",
      entityType: "company",
      entityId: companyId,
      changes: { status: { eski: company.status, yeni: status } },
      isSuperAdminAccess: true,
    });

    return { ok: true as const, data: { id: companyId } };
  });
}

/** Paket değişimi (yükseltme/düşürme). Şirket verisi silinmez; yalnızca etkin modüller değişir. */
export async function setCompanyPlan(session: SuperAdminSession, companyId: string, planId: string): Promise<ServiceResult<{ id: string }>> {
  return withPlatformBypass(async (tx) => {
    const [company, plan] = await Promise.all([
      tx.company.findFirst({ where: { id: companyId, deletedAt: null } }),
      tx.plan.findFirst({ where: { id: planId, isActive: true } }),
    ]);
    if (!company) return notFound();
    if (!plan) return notFound("Paket bulunamadı.");
    if (company.planId === planId) return conflict("Şirket zaten bu pakette.");
    await tx.company.update({ where: { id: companyId }, data: { planId } });
    await writeAuditLog(tx, {
      companyId, userId: session.userId, action: "UPDATE", entityType: "company", entityId: companyId,
      changes: { planId: { eski: company.planId, yeni: planId } }, isSuperAdminAccess: true,
    });
    return { ok: true as const, data: { id: companyId } };
  });
}

export interface CompanyModuleRow {
  key: string;
  name: string;
  isCore: boolean;
  isFree: boolean;
  inPlan: boolean;
  /** Şirkete özel ayar (yoksa null). */
  override: { enabled: boolean; expiresAt: string | null; note: string | null } | null;
  /** Bugün fiilen açık mı (paket + override sonucu). */
  effective: boolean;
}

/** Platform paneli için: şirketin her modülü — pakette mi, override var mı, fiilen açık mı. */
export async function getCompanyModules(companyId: string): Promise<ServiceResult<CompanyModuleRow[]>> {
  return withPlatformBypass(async (tx) => {
    const company = await tx.company.findFirst({ where: { id: companyId, deletedAt: null }, select: { planId: true } });
    if (!company) return notFound();
    const [catalog, planModules, overrides] = await Promise.all([
      tx.appModule.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
      tx.planModule.findMany({ where: { planId: company.planId }, select: { module: { select: { key: true } } } }),
      tx.companyModule.findMany({ where: { companyId }, select: { enabled: true, expiresAt: true, note: true, module: { select: { key: true } } } }),
    ]);
    const planKeys = planModules.map((pm) => pm.module.key);
    const effective = new Set(
      computeEnabledModules({
        catalog,
        planModuleKeys: planKeys,
        overrides: overrides.map((o) => ({ moduleKey: o.module.key, enabled: o.enabled, expiresAt: o.expiresAt })),
      }),
    );
    const byKey = new Map(overrides.map((o) => [o.module.key, o]));
    return {
      ok: true as const,
      data: catalog.map((m) => {
        const o = byKey.get(m.key);
        return {
          key: m.key, name: m.name, isCore: m.isCore, isFree: m.isFree,
          inPlan: planKeys.includes(m.key),
          override: o ? { enabled: o.enabled, expiresAt: o.expiresAt?.toISOString() ?? null, note: o.note } : null,
          effective: effective.has("*") || effective.has(m.key),
        };
      }),
    };
  });
}

/** Şirkete özel modül ekle/çıkar (veya `enabled: null` ile override'ı sil). Çekirdek modüller değiştirilemez. */
export async function setCompanyModule(session: SuperAdminSession, companyId: string, input: CompanyModuleInput): Promise<ServiceResult<{ id: string }>> {
  return withPlatformBypass(async (tx) => {
    const [company, mod] = await Promise.all([
      tx.company.findFirst({ where: { id: companyId, deletedAt: null }, select: { id: true } }),
      tx.appModule.findFirst({ where: { key: input.moduleKey, isActive: true } }),
    ]);
    if (!company) return notFound();
    if (!mod) return notFound("Modül bulunamadı.");
    if (mod.isCore) return conflict("Çekirdek modüller kapatılamaz.");

    if (input.enabled === null) {
      await tx.companyModule.deleteMany({ where: { companyId, moduleId: mod.id } });
    } else {
      await tx.companyModule.upsert({
        where: { companyId_moduleId: { companyId, moduleId: mod.id } },
        update: { enabled: input.enabled, expiresAt: input.expiresAt ?? null, note: input.note ?? null },
        create: { companyId, moduleId: mod.id, enabled: input.enabled, expiresAt: input.expiresAt ?? null, note: input.note ?? null },
      });
    }
    await writeAuditLog(tx, {
      companyId, userId: session.userId, action: "UPDATE", entityType: "company_module", entityId: mod.id,
      changes: { [`modül:${mod.key}`]: { eski: null, yeni: input.enabled === null ? "pakete döndü" : input.enabled ? "eklendi" : "çıkarıldı" } },
      isSuperAdminAccess: true,
    });
    return { ok: true as const, data: { id: mod.id } };
  });
}
