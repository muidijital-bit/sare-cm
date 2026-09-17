import type { Prisma } from "@prisma/client";
import { withTenant } from "@/lib/db/tenant-context";
import { writeAuditLog, diffFields } from "@/lib/audit/log";
import { getRequiredScope } from "@/lib/auth/rbac";
import type { TenantSession } from "@/lib/auth/session";
import type { CompanySettingsInput } from "@/lib/validation/company-settings";
import { type ServiceResult, forbidden, notFound, conflict } from "@/lib/modules/result";

/** SA-01/02/03/07: Şirket ayarlarını getirir/güncelleri. */
export async function getCompanySettings(session: TenantSession) {
  if (!getRequiredScope(session.role, "companySettings", "view")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const company = await tx.company.findUniqueOrThrow({ where: { id: session.companyId } });
    return { ok: true as const, data: company };
  });
}

export async function updateCompanySettings(session: TenantSession, input: CompanySettingsInput): Promise<ServiceResult<{ id: string }>> {
  if (!getRequiredScope(session.role, "companySettings", "edit")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.company.findUniqueOrThrow({ where: { id: session.companyId } });

    await tx.company.update({
      where: { id: session.companyId },
      data: {
        name: input.name,
        taxOffice: input.taxOffice || null,
        taxNumber: input.taxNumber || null,
        address: input.address || null,
        phone: input.phone || null,
        defaultVatRate: input.defaultVatRate,
        quoteValidityDays: input.quoteValidityDays,
        quoteNumberFormat: input.quoteNumberFormat,
        orderNumberFormat: input.orderNumberFormat,
      },
    });

    await writeAuditLog(tx, {
      companyId: session.companyId,
      userId: session.userId,
      action: "UPDATE",
      entityType: "company",
      entityId: session.companyId,
      changes: diffFields(
        { name: existing.name, defaultVatRate: existing.defaultVatRate.toString() },
        { name: input.name, defaultVatRate: String(input.defaultVatRate) },
      ),
    });

    return { ok: true as const, data: { id: session.companyId } };
  });
}

// =========================================================
// SA-04/05/06: Kaynak / Kategori / Hesap CRUD (ortak desen)
// =========================================================

type RefModel = "customerSource" | "expenseCategory" | "account";

async function assertRefUnused(tx: Prisma.TransactionClient, model: RefModel, id: string): Promise<boolean> {
  if (model === "customerSource") {
    return (await tx.customer.count({ where: { sourceId: id, deletedAt: null } })) === 0;
  }
  if (model === "expenseCategory") {
    return (await tx.expense.count({ where: { categoryId: id, deletedAt: null } })) === 0;
  }
  const paymentCount = await tx.payment.count({ where: { accountId: id } });
  const expenseCount = await tx.expense.count({ where: { accountId: id, deletedAt: null } });
  return paymentCount === 0 && expenseCount === 0;
}

export async function createCustomerSource(session: TenantSession, name: string): Promise<ServiceResult<{ id: string }>> {
  if (!getRequiredScope(session.role, "companySettings", "edit")) return forbidden();
  return withTenant(session.companyId, async (tx) => {
    const row = await tx.customerSource.create({ data: { companyId: session.companyId, name } });
    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "CREATE", entityType: "customerSource", entityId: row.id });
    return { ok: true as const, data: { id: row.id } };
  });
}

export async function updateCustomerSource(session: TenantSession, id: string, name: string): Promise<ServiceResult<{ id: string }>> {
  if (!getRequiredScope(session.role, "companySettings", "edit")) return forbidden();
  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.customerSource.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return notFound();
    await tx.customerSource.update({ where: { id }, data: { name } });
    return { ok: true as const, data: { id } };
  });
}

export async function deleteCustomerSource(session: TenantSession, id: string): Promise<ServiceResult<{ id: string }>> {
  if (!getRequiredScope(session.role, "companySettings", "edit")) return forbidden();
  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.customerSource.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return notFound();
    if (!(await assertRefUnused(tx, "customerSource", id))) return conflict("Bu kaynağı kullanan müşteriler var, silinemez.");
    await tx.customerSource.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true as const, data: { id } };
  });
}

export async function createExpenseCategory(session: TenantSession, name: string): Promise<ServiceResult<{ id: string }>> {
  if (!getRequiredScope(session.role, "companySettings", "edit")) return forbidden();
  return withTenant(session.companyId, async (tx) => {
    const row = await tx.expenseCategory.create({ data: { companyId: session.companyId, name } });
    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "CREATE", entityType: "expenseCategory", entityId: row.id });
    return { ok: true as const, data: { id: row.id } };
  });
}

export async function updateExpenseCategory(session: TenantSession, id: string, name: string): Promise<ServiceResult<{ id: string }>> {
  if (!getRequiredScope(session.role, "companySettings", "edit")) return forbidden();
  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.expenseCategory.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return notFound();
    await tx.expenseCategory.update({ where: { id }, data: { name } });
    return { ok: true as const, data: { id } };
  });
}

export async function deleteExpenseCategory(session: TenantSession, id: string): Promise<ServiceResult<{ id: string }>> {
  if (!getRequiredScope(session.role, "companySettings", "edit")) return forbidden();
  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.expenseCategory.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return notFound();
    if (!(await assertRefUnused(tx, "expenseCategory", id))) return conflict("Bu kategoriyi kullanan giderler var, silinemez.");
    await tx.expenseCategory.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true as const, data: { id } };
  });
}

export async function createAccount(session: TenantSession, name: string, type: "CASH" | "BANK"): Promise<ServiceResult<{ id: string }>> {
  if (!getRequiredScope(session.role, "companySettings", "edit")) return forbidden();
  return withTenant(session.companyId, async (tx) => {
    const row = await tx.account.create({ data: { companyId: session.companyId, name, type } });
    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "CREATE", entityType: "account", entityId: row.id });
    return { ok: true as const, data: { id: row.id } };
  });
}

export async function updateAccount(session: TenantSession, id: string, name: string, type: "CASH" | "BANK"): Promise<ServiceResult<{ id: string }>> {
  if (!getRequiredScope(session.role, "companySettings", "edit")) return forbidden();
  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.account.findFirst({ where: { id, isActive: true } });
    if (!existing) return notFound();
    await tx.account.update({ where: { id }, data: { name, type } });
    return { ok: true as const, data: { id } };
  });
}

export async function deleteAccount(session: TenantSession, id: string): Promise<ServiceResult<{ id: string }>> {
  if (!getRequiredScope(session.role, "companySettings", "edit")) return forbidden();
  return withTenant(session.companyId, async (tx) => {
    const existing = await tx.account.findFirst({ where: { id, isActive: true } });
    if (!existing) return notFound();
    if (!(await assertRefUnused(tx, "account", id))) return conflict("Bu hesaba bağlı tahsilat/gider var, silinemez.");
    await tx.account.update({ where: { id }, data: { isActive: false } });
    return { ok: true as const, data: { id } };
  });
}
