import type { Prisma, AuditAction } from "@prisma/client";

export interface AuditLogInput {
  companyId: string | null;
  userId: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  /** IG-02: alan bazında { alan: { eski, yeni } } farkı. Şifre/token gibi hassas alanlar ASLA buraya konmaz. */
  changes?: Record<string, { eski: unknown; yeni: unknown }>;
  ip?: string | null;
  userAgent?: string | null;
  isSuperAdminAccess?: boolean;
}

/**
 * IG-01..IG-04 — audit_logs değiştirilemez/silinemez bir tablodur (yalnızca INSERT).
 *
 * Önemli: bu fonksiyon, ait olduğu iş işlemiyle AYNI transaction client'ı (`tx`) ile
 * çağrılmalıdır (bkz. src/lib/db/tenant-context.ts `withTenant`). Böylece kayıt ile onun
 * audit log'u atomik olur: biri başarısız olursa ikisi de geri alınır (rollback).
 *
 * `changes` içine ASLA şifre/token gibi hassas alanlar konmaz (bkz. §9 Güvenlik).
 */
export async function writeAuditLog(tx: Prisma.TransactionClient, input: AuditLogInput): Promise<void> {
  await tx.auditLog.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      changes: input.changes as Prisma.InputJsonValue | undefined,
      ip: input.ip ?? undefined,
      userAgent: input.userAgent ?? undefined,
      isSuperAdminAccess: input.isSuperAdminAccess ?? false,
    },
  });
}

const SENSITIVE_FIELDS = new Set(["password", "passwordHash", "token", "twoFactorSecret"]);

/**
 * İki obje arasındaki alan farkını IG-02 formatına çevirir; hassas alanları otomatik eler.
 */
export function diffFields<T extends Record<string, unknown>>(before: T, after: Partial<T>): AuditLogInput["changes"] {
  const changes: NonNullable<AuditLogInput["changes"]> = {};
  for (const key of Object.keys(after)) {
    if (SENSITIVE_FIELDS.has(key)) continue;
    const eski = before[key];
    const yeni = after[key as keyof T];
    if (eski !== yeni) {
      changes[key] = { eski, yeni };
    }
  }
  return changes;
}
