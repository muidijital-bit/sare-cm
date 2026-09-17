import type { Prisma } from "@prisma/client";
import { withTenant, withPlatformBypass } from "@/lib/db/tenant-context";
import { writeAuditLog } from "@/lib/audit/log";
import { getRequiredScope, type MembershipRole } from "@/lib/auth/rbac";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { generateSecureToken, INVITATION_TOKEN_TTL_MS } from "@/lib/security/tokens";
import type { TenantSession } from "@/lib/auth/session";
import type { InviteUserInput, UpdateMembershipInput } from "@/lib/validation/users";
import { type ServiceResult, forbidden, notFound, conflict } from "@/lib/modules/result";

export interface CompanyUserRow {
  kind: "member" | "invitation";
  id: string; // membership.id veya invitationToken.id
  email: string;
  name: string | null;
  role: MembershipRole;
  isActive: boolean;
  invitedAt?: Date;
  expiresAt?: Date;
}

/** KY-04..KY-08: şirketin aktif üyeleri + bekleyen davetleri birleşik liste. */
export async function listCompanyUsers(session: TenantSession): Promise<ServiceResult<CompanyUserRow[]>> {
  if (!getRequiredScope(session.role, "userManagement", "view")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const memberships = await tx.membership.findMany({
      where: { companyId: session.companyId },
      include: { user: { select: { email: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });

    const invitations = await tx.invitationToken.findMany({
      where: { companyId: session.companyId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });

    const rows: CompanyUserRow[] = [
      ...memberships.map((m) => ({
        kind: "member" as const,
        id: m.id,
        email: m.user.email,
        name: m.user.name,
        role: m.role,
        isActive: m.isActive,
      })),
      ...invitations.map((i) => ({
        kind: "invitation" as const,
        id: i.id,
        email: i.email,
        name: null,
        role: i.role,
        isActive: true,
        invitedAt: i.createdAt,
        expiresAt: i.expiresAt,
      })),
    ];

    return { ok: true as const, data: rows };
  });
}

/** KY-04/KY-08: davet oluşturur — paket kullanıcı limiti doluysa engellenir. */
export async function inviteUser(session: TenantSession, input: InviteUserInput): Promise<ServiceResult<{ token: string; expiresAt: Date }>> {
  if (!getRequiredScope(session.role, "userManagement", "create")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const company = await tx.company.findUniqueOrThrow({ where: { id: session.companyId }, include: { plan: true } });

    const activeMemberCount = await tx.membership.count({ where: { companyId: session.companyId, isActive: true } });
    const pendingInviteCount = await tx.invitationToken.count({
      where: { companyId: session.companyId, acceptedAt: null, expiresAt: { gt: new Date() } },
    });
    if (activeMemberCount + pendingInviteCount >= company.plan.maxUsers) {
      return conflict(`Paket kullanıcı limitine (${company.plan.maxUsers}) ulaşıldı. Yeni davet gönderilemez.`);
    }

    const existingMembership = await tx.membership.findFirst({
      where: { companyId: session.companyId, isActive: true, user: { email: input.email } },
    });
    if (existingMembership) return conflict("Bu e-posta zaten şirketin aktif bir üyesi.");

    const existingInvite = await tx.invitationToken.findFirst({
      where: { companyId: session.companyId, email: input.email, acceptedAt: null, expiresAt: { gt: new Date() } },
    });
    if (existingInvite) return conflict("Bu e-postaya zaten bekleyen bir davet var.");

    const token = generateSecureToken();
    const expiresAt = new Date(Date.now() + INVITATION_TOKEN_TTL_MS);

    await tx.invitationToken.create({
      data: { companyId: session.companyId, email: input.email, role: input.role, token, invitedBy: session.userId, expiresAt },
    });

    await writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "USER_INVITE", entityType: "invitation", changes: { email: { eski: null, yeni: input.email }, role: { eski: null, yeni: input.role } } });

    return { ok: true as const, data: { token, expiresAt } };
  });
}

/** Davet iptali (henüz kabul edilmemiş). */
export async function cancelInvitation(session: TenantSession, invitationId: string): Promise<ServiceResult<{ id: string }>> {
  if (!getRequiredScope(session.role, "userManagement", "create")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const invite = await tx.invitationToken.findFirst({ where: { id: invitationId, companyId: session.companyId, acceptedAt: null } });
    if (!invite) return notFound();
    await tx.invitationToken.delete({ where: { id: invitationId } });
    return { ok: true as const, data: { id: invitationId } };
  });
}

async function countActiveOwners(tx: Prisma.TransactionClient, companyId: string, excludeMembershipId?: string) {
  return tx.membership.count({
    where: { companyId, role: "OWNER", isActive: true, ...(excludeMembershipId ? { id: { not: excludeMembershipId } } : {}) },
  });
}

/** Rol değiştirme / pasifleştirme-aktifleştirme — son Sahip korumalıdır (§4). */
export async function updateMembership(session: TenantSession, membershipId: string, input: UpdateMembershipInput): Promise<ServiceResult<{ id: string }>> {
  if (!getRequiredScope(session.role, "userManagement", "edit")) return forbidden();

  return withTenant(session.companyId, async (tx) => {
    const membership = await tx.membership.findFirst({ where: { id: membershipId, companyId: session.companyId }, include: { user: true } });
    if (!membership) return notFound();

    const remainingActiveOwners = await countActiveOwners(tx, session.companyId, membershipId);
    const wouldRemoveLastOwner =
      membership.role === "OWNER" &&
      membership.isActive &&
      remainingActiveOwners === 0 &&
      ((input.role !== undefined && input.role !== "OWNER") || input.isActive === false);
    if (wouldRemoveLastOwner) {
      return conflict("Şirketin son Sahip'i pasifleştirilemez veya rolü düşürülemez.");
    }

    if (input.isActive === true && !membership.isActive) {
      const company = await tx.company.findUniqueOrThrow({ where: { id: session.companyId }, include: { plan: true } });
      const activeMemberCount = await tx.membership.count({ where: { companyId: session.companyId, isActive: true } });
      if (activeMemberCount >= company.plan.maxUsers) {
        return conflict(`Paket kullanıcı limitine (${company.plan.maxUsers}) ulaşıldı.`);
      }
    }

    const before = { role: membership.role, isActive: membership.isActive };
    await tx.membership.update({
      where: { id: membershipId },
      data: { ...(input.role !== undefined ? { role: input.role } : {}), ...(input.isActive !== undefined ? { isActive: input.isActive } : {}) },
    });

    await writeAuditLog(tx, {
      companyId: session.companyId,
      userId: session.userId,
      action: input.isActive === false ? "USER_DEACTIVATE" : input.role !== undefined ? "ROLE_CHANGE" : "UPDATE",
      entityType: "membership",
      entityId: membershipId,
      changes: {
        ...(input.role !== undefined && input.role !== before.role ? { role: { eski: before.role, yeni: input.role } } : {}),
        ...(input.isActive !== undefined && input.isActive !== before.isActive ? { isActive: { eski: before.isActive, yeni: input.isActive } } : {}),
      },
    });

    return { ok: true as const, data: { id: membershipId } };
  });
}

export interface InvitationInfo {
  email: string;
  role: MembershipRole;
  companyName: string;
  valid: boolean;
}

/** Davet kabul sayfası için — oturumsuz, bilinçli olarak `withPlatformBypass` kullanır. */
export async function getInvitationInfo(token: string): Promise<InvitationInfo | null> {
  return withPlatformBypass(async (tx) => {
    const invite = await tx.invitationToken.findUnique({ where: { token }, include: { company: { select: { name: true } } } });
    if (!invite) return null;
    const valid = !invite.acceptedAt && invite.expiresAt > new Date();
    return { email: invite.email, role: invite.role, companyName: invite.company.name, valid };
  });
}

/** KY-04: daveti kabul eder — kullanıcı yoksa oluşturur, üyelik açar. Oturumsuz (public) uçtan çağrılır. */
export async function acceptInvitation(token: string, name: string, password: string): Promise<ServiceResult<{ email: string }>> {
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) return { ok: false, status: 400, message: passwordCheck.errors.join(" ") };

  return withPlatformBypass(async (tx) => {
    const invite = await tx.invitationToken.findUnique({ where: { token } });
    if (!invite) return notFound("Davet bulunamadı.");
    if (invite.acceptedAt || invite.expiresAt <= new Date()) {
      return conflict("Bu davet bağlantısı geçersiz, kullanılmış veya süresi dolmuş.");
    }

    const company = await tx.company.findUniqueOrThrow({ where: { id: invite.companyId }, include: { plan: true } });
    const activeMemberCount = await tx.membership.count({ where: { companyId: invite.companyId, isActive: true } });
    if (activeMemberCount >= company.plan.maxUsers) {
      return conflict(`Paket kullanıcı limitine (${company.plan.maxUsers}) ulaşıldı. Yöneticinizle iletişime geçin.`);
    }

    let user = await tx.user.findUnique({ where: { email: invite.email } });
    if (!user) {
      const passwordHash = await hashPassword(password);
      user = await tx.user.create({ data: { email: invite.email, name, passwordHash, isActive: true } });
    }

    const existingMembership = await tx.membership.findUnique({ where: { userId_companyId: { userId: user.id, companyId: invite.companyId } } });
    if (existingMembership) {
      await tx.membership.update({ where: { id: existingMembership.id }, data: { isActive: true, role: invite.role } });
    } else {
      await tx.membership.create({ data: { userId: user.id, companyId: invite.companyId, role: invite.role, isActive: true } });
    }

    await tx.invitationToken.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });

    await writeAuditLog(tx, { companyId: invite.companyId, userId: user.id, action: "CREATE", entityType: "membership", entityId: user.id, isSuperAdminAccess: false });

    return { ok: true as const, data: { email: invite.email } };
  });
}
