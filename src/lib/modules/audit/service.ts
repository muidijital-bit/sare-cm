import type { Prisma } from "@prisma/client";
import { withTenant } from "@/lib/db/tenant-context";
import { getRequiredScope } from "@/lib/auth/rbac";
import type { TenantSession } from "@/lib/auth/session";
import { forbidden } from "@/lib/modules/result";

interface ListParams {
  userId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page: number;
  pageSize: number;
}

export interface AuditLogRow {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  changes: unknown;
  createdAt: Date;
  userName: string | null;
  userEmail: string | null;
}

/**
 * IG-06: Genel log ekranı — kullanıcı, tarih aralığı, modül, işlem tipi filtreleri.
 * `audit_logs.user_id` bilinçli olarak ilişkisiz (ham UUID) bırakıldığından
 * (bkz. .claude/agents/db-schema-architect.md — ilişki patlaması önlemi), kullanıcı
 * adları burada ayrı bir sorguyla eşlenir.
 */
export async function listAuditLogs(session: TenantSession, params: ListParams) {
  if (!getRequiredScope(session.role, "auditLog", "view")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const where: Prisma.AuditLogWhereInput = {
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.entityType ? { entityType: params.entityType } : {}),
      ...(params.entityId ? { entityId: params.entityId } : {}),
      ...(params.action ? { action: params.action as Prisma.EnumAuditActionFilter["equals"] } : {}),
      ...(params.dateFrom || params.dateTo
        ? { createdAt: { ...(params.dateFrom ? { gte: params.dateFrom } : {}), ...(params.dateTo ? { lte: params.dateTo } : {}) } }
        : {}),
    };

    const [logs, total] = await Promise.all([
      tx.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (params.page - 1) * params.pageSize, take: params.pageSize }),
      tx.auditLog.count({ where }),
    ]);

    const userIds = Array.from(new Set(logs.map((l) => l.userId).filter((id): id is string => !!id)));
    const users = userIds.length > 0 ? await tx.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const items: AuditLogRow[] = logs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      changes: l.changes,
      createdAt: l.createdAt,
      userName: l.userId ? userMap.get(l.userId)?.name ?? null : null,
      userEmail: l.userId ? userMap.get(l.userId)?.email ?? null : null,
    }));

    return { ok: true as const, data: { items, total, page: params.page, pageSize: params.pageSize } };
  });
}

/** IG-05: Kayıt detay ekranındaki "değişiklik geçmişi" sekmesi için — tek bir kaydın geçmişi. */
export async function listEntityAuditTrail(session: TenantSession, entityType: string, entityId: string) {
  return listAuditLogs(session, { entityType, entityId, page: 1, pageSize: 50 });
}
