import { cache } from "react";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db/prisma";
import { InvalidCompanyIdError } from "@/lib/db/tenant-context";
import type { MembershipRole } from "@/lib/auth/rbac";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface MembershipRow {
  id: string;
  role: MembershipRole;
  company_id: string;
  company_name: string;
  company_status: "TRIAL" | "ACTIVE" | "SUSPENDED";
}

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
  if (!UUID_RE.test(session.activeCompanyId)) return null; // bozuk/uydurma companyId

  // PERFORMANS — KÖK NEDEN DÜZELTMESİ: Prisma'nın interactive/array $transaction'ı
  // BEGIN/COMMIT için AYRI wire round-trip'leri gerektiriyor (Neon'un pooled endpoint'inde
  // ölçüldü: ~1,4-2sn — bkz. git geçmişi). Postgres'te HER TEK statement kendi implicit
  // transaction'ında çalışır; `set_config(..., true)` bu yüzden AYRI bir BEGIN olmadan da
  // "local" (yalnızca bu statement) olarak doğru çalışır. set_config + gerçek sorgu TEK
  // CTE'li raw SQL statement'ında birleştirilince RLS güvenliği bozulmadan (bağlam
  // transaction bitince otomatik temizlenir, havuza sızmaz) TEK round-trip'e iner —
  // ölçülen: ~1,4sn → ~200ms (bkz. scripts/measure-latency.ts).
  let rows: MembershipRow[];
  try {
    rows = await prisma.$queryRaw<MembershipRow[]>(Prisma.sql`
      WITH _ctx AS (
        SELECT set_config('app.current_company_id', ${session.activeCompanyId}, true) AS a,
               set_config('app.bypass_rls', 'off', true) AS b
      )
      SELECT m.id, m.role::text AS role, m.company_id, c.name AS company_name, c.status::text AS company_status
      FROM memberships m
      JOIN companies c ON c.id = m.company_id
      CROSS JOIN _ctx
      WHERE m.user_id = ${session.user.id}::uuid
        AND m.company_id = ${session.activeCompanyId}::uuid
        AND m.is_active = true
        AND c.deleted_at IS NULL
      LIMIT 1
    `);
  } catch (e) {
    if (e instanceof InvalidCompanyIdError) return null;
    throw e;
  }
  const membership = rows[0];
  if (!membership) return null;

  return {
    userId: session.user.id,
    userName: session.user.name ?? "",
    userEmail: session.user.email ?? "",
    companyId: membership.company_id,
    companyName: membership.company_name,
    companyStatus: membership.company_status,
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
