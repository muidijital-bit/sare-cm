// .env dosyasını manuel yükler — tsx ile doğrudan çalıştırılan betikler (next dev/build'in aksine) .env'i otomatik okumaz.
import "dotenv/config";

/**
 * TEK SEFERLİK kurulum betiği — Neon'un varsayılan sahip rolü (`neondb_owner`)
 * `BYPASSRLS` özniteliğine sahip olduğundan (Neon projelerinde standart davranış),
 * `FORCE ROW LEVEL SECURITY` dahil TÜM RLS politikalarını sessizce atlar. Bu, gerçek
 * bir izolasyon açığı olurdu: uygulama sahip rolüyle bağlanırsa RLS hiç çalışmaz.
 *
 * Bu betik, RLS'e gerçekten tabi, en az ayrıcalıklı bir `app_user` rolü oluşturur.
 * `.env`'deki `DATABASE_URL` (sahip — yalnızca migration/admin için) DEĞİŞMEDEN kalır;
 * uygulama çalışma zamanı `APP_DATABASE_URL` (bu yeni rol) kullanır — bkz. src/lib/db/prisma.ts.
 *
 * Çalıştırma: npx tsx scripts/setup-app-role.ts
 * (DATABASE_URL — sahip bağlantısı — .env'de tanımlı olmalı; CREATE ROLE/GRANT gerektirir.)
 */
import { randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";

const ROLE_NAME = "app_user";

async function main() {
  const ownerDb = new PrismaClient(); // DATABASE_URL (sahip) ile bağlanır

  const existing = await ownerDb.$queryRaw<{ rolname: string }[]>`
    SELECT rolname FROM pg_roles WHERE rolname = ${ROLE_NAME}
  `;

  const resetPassword = process.argv.includes("--reset-password");
  let password: string;
  if (existing.length > 0 && resetPassword) {
    // Parola uyuşmazlığında (28P01) — yeni rastgele parola; yetkiler/RLS rolde kalır, rol yeniden OLUŞTURULMAZ.
    password = randomBytes(24).toString("hex");
    await ownerDb.$executeRawUnsafe(`ALTER ROLE "${ROLE_NAME}" WITH LOGIN PASSWORD '${password}'`);
    console.log(`Rol '${ROLE_NAME}' parolası yenilendi.`);
  } else if (existing.length > 0) {
    console.log(`Rol '${ROLE_NAME}' zaten var — parola SIFIRLANMAYACAK, yalnızca yetkiler tazelenecek.`);
    console.log("(Parola uyuşmuyorsa: npx tsx scripts/setup-app-role.ts --reset-password)");
    password = "<mevcut-parola-degismedi>";
  } else {
    password = randomBytes(24).toString("hex"); // yalnızca hex karakterler — SQL string literal'inde güvenli
    await ownerDb.$executeRawUnsafe(
      `CREATE ROLE "${ROLE_NAME}" WITH LOGIN PASSWORD '${password}' NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`,
    );
    console.log(`Rol '${ROLE_NAME}' oluşturuldu (NOBYPASSRLS).`);
  }

  await ownerDb.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${ROLE_NAME}"`);
  await ownerDb.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${ROLE_NAME}"`);
  // Gelecekteki migration'larla eklenecek yeni tablolar için de aynı yetkiler otomatik uygulansın.
  await ownerDb.$executeRawUnsafe(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${ROLE_NAME}"`,
  );
  console.log("Yetkiler (SELECT/INSERT/UPDATE/DELETE + gelecekteki tablolar için varsayılan) verildi.");

  await ownerDb.$disconnect();

  if (existing.length === 0 || resetPassword) {
    // Hazır bağlantı adresi: sahip adresinin host/db kısmı + yeni kullanıcı/parola. channel_binding
    // parametresi çıkarılır — Prisma 5 bu parametreyle Neon'a bağlanamıyor (P1001), sslmode=require yeter.
    const owner = new URL(process.env.DATABASE_URL!);
    const appUrl = new URL(owner.toString());
    appUrl.username = ROLE_NAME;
    appUrl.password = password;
    appUrl.searchParams.delete("channel_binding");
    appUrl.searchParams.set("sslmode", "require");
    const ownerClean = new URL(owner.toString());
    ownerClean.searchParams.delete("channel_binding");

    // Yeni parolayla gerçekten bağlanılabildiğini doğrula (veri okumaz).
    const appDb = new PrismaClient({ datasources: { db: { url: appUrl.toString() } } });
    const ok = await appDb.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`.then(() => true).catch((e) => (console.error(e), false));
    await appDb.$disconnect();
    console.log(ok ? "\n✅ app_user yeni parolayla bağlandı." : "\n❌ app_user bağlantı testi BAŞARISIZ — aşağıdaki adresi kullanmayın.");

    console.log(`\nVeritabanı sunucusu: ${owner.hostname.split(".")[0]}`);
    console.log("\n--- Yerel .env (canlı satırları) ---");
    console.log(`PROD_DATABASE_URL="${ownerClean.toString()}"`);
    console.log(`PROD_APP_DATABASE_URL="${appUrl.toString()}"`);
    console.log("\n--- Vercel → Environment Variables (Production) ---");
    console.log(`DATABASE_URL      = ${ownerClean.toString()}`);
    console.log(`APP_DATABASE_URL  = ${appUrl.toString()}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});