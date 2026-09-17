import { withPlatformBypass } from "@/lib/db/tenant-context";
import { writeAuditLog } from "@/lib/audit/log";
import { generateSecureToken, INVITATION_TOKEN_TTL_MS } from "@/lib/security/tokens";
import type { SuperAdminSession } from "@/lib/auth/session";
import type { CreateCompanyInput, CreatePlanInput } from "@/lib/validation/platform";
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
