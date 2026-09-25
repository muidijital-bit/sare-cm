import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class InvalidCompanyIdError extends Error {}

/**
 * Neon (serverless Postgres) boşta kalan bağlantıları kapatır; Prisma bunu ilk kullanımda
 * P1017 ("Server has closed the connection") / P1001 ("Can't reach database server") olarak görür.
 * Bu, kullanıcıya hata göstermeden TEK KEZ yeniden denenecek geçici bir durumdur.
 */
function isConnectionLost(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code;
  return code === "P1017" || code === "P1001";
}

async function retryReadOnConnectionLoss<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (!isConnectionLost(e)) throw e;
    return run();
  }
}

/**
 * TÜM kiracı-kapsamlı (tenant-scoped) veritabanı işlemleri bu fonksiyon üzerinden yapılır.
 *
 * Bir transaction açar, Postgres oturum değişkenini (`app.current_company_id`) YALNIZCA bu
 * transaction için ayarlar (`set_config(..., true)` → "local", `SET LOCAL` ile eşdeğer) ve
 * verilen callback'i bu transaction client'ı ile çalıştırır. RLS politikaları
 * (bkz. prisma/sql/001_row_level_security.sql) bu değişkene göre satırları filtreler.
 *
 * Neden transaction + local? Bağlantı havuzlaması (özellikle pgbouncer transaction modu)
 * altında bir oturum değişkenini "session-wide" set etmek, aynı bağlantı başka bir isteğe
 * geri döndüğünde önceki şirketin bağlamının sızmasına yol açabilir. `true` (local) bu
 * riski ortadan kaldırır: değişken yalnızca bu transaction'ın ömrü boyunca geçerlidir.
 *
 * RLS tek başına yeterli GÖRÜLMEMELİDİR — her sorgu ayrıca uygulama/servis katmanında da
 * `companyId` ile filtrelenmelidir (savunma derinliği, bkz. db-schema-architect agent notu).
 */
export async function withTenant<T>(
  companyId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { timeoutMs?: number },
): Promise<T> {
  if (!UUID_RE.test(companyId)) {
    throw new InvalidCompanyIdError(`Geçersiz company_id: ${companyId}`);
  }
  // Yeniden deneme YALNIZCA callback henüz başlamadıysa (BEGIN/set_config aşamasında bağlantı kaybı)
  // yapılır: callback çalışmaya başladıktan sonra yazma tekrarlanırsa mükerrer kayıt riski olur.
  let started = false;
  const run = () =>
    prisma.$transaction(
      async (tx) => {
        // İki set_config çağrısı TEK sorguda birleştirilir — her ayrı $executeRaw çağrısı
        // Neon'a (bu ortamdan ~150-250ms) bir tam network round-trip demek; bunu iki yerine
        // bir round-trip'e indirmek her tenant-kapsamlı sorguda ölçülebilir gecikme kazandırır
        // (bkz. scripts/measure-latency.ts ile ölçülen gerçek rakamlar).
        await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true), set_config('app.bypass_rls', 'off', true)`;
        started = true;
        return fn(tx);
      },
      // Neon gibi serverless sağlayıcılarda uyanma (cold start) gecikmesi olabilir;
      // Prisma'nın 5sn'lik `timeout` ve 2sn'lik `maxWait` varsayılanları bunun için dar —
      // bkz. prisma/seed.ts'te yaşanan P2028 ve tarayıcıda yaşanan "Unable to start a
      // transaction in the given time" (maxWait) hatası.
      { timeout: options?.timeoutMs ?? 15_000, maxWait: 15_000 },
    );
  try {
    return await run();
  } catch (e) {
    if (started || !isConnectionLost(e)) throw e;
    started = false;
    return run();
  }
}

/**
 * SALT-OKUNUR hızlı yol. `withTenant()` bir "interactive transaction" açar: BEGIN → SET →
 * sorgu → COMMIT, yani Neon'a DÖRT ayrı network round-trip (bu ortamdan ölçülen: toplam
 * ~1,4sn). Prisma'nın dizi formundaki `$transaction([...])` ise tüm ifadeleri TEK round-trip
 * içinde gönderir. Sorgular önceden biliniyorsa (araya JS mantığı girmiyorsa) bu fonksiyon
 * aynı RLS güvencesini ~4 kat daha hızlı verir.
 *
 * Kullanım:
 *   const [customers, sources] = await withTenantRead(companyId, (db) => [
 *     db.customer.findMany({ ... }),
 *     db.customerSource.findMany({ ... }),
 *   ]);
 *
 * NOT: RLS bağlamı (`set_config(..., true)`) aynı transaction'ın parçası olarak ilk ifade
 * olarak gönderilir; "local" olduğu için transaction bitince otomatik temizlenir — havuzdan
 * başka bir isteğe sızmaz (bkz. withTenant açıklaması).
 */
export async function withTenantRead<T extends readonly unknown[]>(
  companyId: string,
  build: (db: typeof prisma) => [...{ [K in keyof T]: Prisma.PrismaPromise<T[K]> }],
): Promise<T> {
  if (!UUID_RE.test(companyId)) {
    throw new InvalidCompanyIdError(`Geçersiz company_id: ${companyId}`);
  }

  // Salt-okunur olduğundan bağlantı kaybında tümüyle yeniden denemek güvenlidir (sorgular yeniden kurulur).
  return retryReadOnConnectionLoss(async () => {
    const setContext = prisma.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true), set_config('app.bypass_rls', 'off', true)`;
    const results = await prisma.$transaction([setContext, ...build(prisma)]);
    // İlk eleman set_config sonucudur, atılır.
    return results.slice(1) as unknown as T;
  });
}

/**
 * Yalnızca platform/süper admin kod yollarında kullanılır — RLS'i bilinçli olarak atlayıp
 * çoklu şirket verisine erişim gerektiren raporlar için (örn. PF-05, PF-06). Bu fonksiyonu
 * çağıran kod, erişimi mutlaka `writeAuditLog(..., { isSuperAdminAccess: true })` ile
 * kaydetmelidir (bkz. PF-07, src/lib/audit/log.ts).
 */
export async function withPlatformBypass<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { timeoutMs?: number },
): Promise<T> {
  let started = false; // bkz. withTenant: yeniden deneme yalnızca callback başlamadan önce
  const run = () =>
    prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
        started = true;
        return fn(tx);
      },
      { timeout: options?.timeoutMs ?? 15_000, maxWait: 15_000 },
    );
  try {
    return await run();
  } catch (e) {
    if (started || !isConnectionLost(e)) throw e;
    started = false;
    return run();
  }
}
