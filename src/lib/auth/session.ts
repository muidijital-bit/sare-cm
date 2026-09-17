import { cache } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { withTenantRead, InvalidCompanyIdError } from "@/lib/db/tenant-context";
import type { MembershipRole } from "@/lib/auth/rbac";

export interface TenantSession {
  userId: string;
  userName: string;
  userEmail: string;
  companyId: string;
  companyName: string;
  companyStatus: "TRIAL" | "ACTIVE" | "SUSPENDED";
  role: MembershipRole;
  /** Kullanıcının üye olduğu toplam şirket sayısı — şirket değiştir bağlantısını göstermek için. */
  membershipCount: number;
}

/**
 * Bir API route/server action'ın başında çağrılır. Oturumdaki `activeCompanyId`
 * (JWT'den gelen, istemci tarafından tetiklenebilen bir değerdir) KÖRÜ KÖRÜNE
 * kullanılmaz — kullanıcının bu şirkette gerçekten aktif bir üyeliği olduğu her
 * seferinde veritabanından yeniden doğrulanır (bkz. .claude/agents/auth-tenant-security.md).
 *
 * Dönüş `null` ise: oturum yok, aktif şirket seçilmemiş, ya da üyelik artık geçerli değil
 * (pasifleştirilmiş kullanıcı, silinmiş şirket) — çağıran taraf 401/403 dönmelidir.
 *
 * PERFORMANS: React `cache()` ile sarılıdır — aynı istek içinde hem layout hem page (hem de
 * varsa iç bileşenler) bunu çağırıyor; sarmadan önce her çağrı Neon'a ayrı bir transaction
 * round-trip'i (~1,4sn) açıyordu ve tek sayfa açılışı 3 ayrı doğrulama sorgusu yapıyordu.
 * `cache()` istek başına tek çağrıya indirir (güvenlik davranışı aynı: her İSTEKTE
 * veritabanından yeniden doğrulanır, sadece istek içinde tekrarlanmaz).
 */
export const getTenantSession = cache(async function getTenantSession(): Promise<TenantSession | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.activeCompanyId) return null;

  // RLS'e tabi bir tabloyu (`memberships`) sorguladığımız için `withTenant` ile bağlam
  // set edilir — hedef companyId zaten `session.activeCompanyId` olduğundan, bu hem
  // RLS'i doğru şekilde tatmin eder hem de erişimi tam olarak o şirketle sınırlar.
  let membership;
  try {
    // Tek sorgu + tek round-trip (withTenantRead): bu fonksiyon HER istekte çalıştığı için
    // interactive transaction'ın 4 round-trip'i doğrudan sayfa açılış süresine biniyordu.
    [membership] = await withTenantRead(session.activeCompanyId, (db) => [
      db.membership.findFirst({
        where: {
          userId: session.user.id,
          companyId: session.activeCompanyId!,
          isActive: true,
          company: { deletedAt: null },
        },
        include: { company: { select: { status: true, name: true } } },
      }),
    ]);
  } catch (e) {
    if (e instanceof InvalidCompanyIdError) return null; // bozuk/uydurma companyId — 401/403'e düşer
    throw e;
  }
  if (!membership) return null;

  return {
    userId: session.user.id,
    userName: session.user.name ?? "",
    userEmail: session.user.email ?? "",
    companyId: membership.companyId,
    companyName: membership.company.name,
    companyStatus: membership.company.status,
    role: membership.role,
    membershipCount: session.memberships?.length ?? 1,
  };
});

/**
 * PF-04: Askıya alınmış şirket salt-okunur moda geçer — veri silinmez, okunabilir,
 * ancak yazma (create/update/delete) işlemleri engellenir. Mutasyon yapan her route
 * bu kontrolü çağırmalıdır.
 */
export function assertWritable(session: TenantSession): { ok: true } | { ok: false; message: string } {
  if (session.companyStatus === "SUSPENDED") {
    return { ok: false, message: "Şirketiniz askıya alınmış durumda; bu işlem için salt-okunur moddasınız." };
  }
  return { ok: true };
}

export interface SuperAdminSession {
  userId: string;
}

/** PF-08: Süper admin paneli — ayrı yol, `isSuperAdmin` + (TODO) zorunlu 2FA doğrulaması. */
export async function getSuperAdminSession(): Promise<SuperAdminSession | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.isSuperAdmin) return null;
  // TODO(auth-tenant-security): 2FA doğrulama adımı tamamlanmadan bu fonksiyon
  // tam güvenli sayılmamalıdır — bkz. User.twoFactorSecret ve PF-08.
  return { userId: session.user.id };
}
