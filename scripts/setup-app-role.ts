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

  let password: string;
  if (existing.length > 0) {
    console.log(`Rol '${ROLE_NAME}' zaten var — parola SIFIRLANMAYACAK, yalnızca yetkiler tazelenecek.`);
    console.log("(Parolayı unuttuysanız Neon konsolundan veya ALTER ROLE ile sıfırlayabilirsiniz.)");
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

  if (existing.length === 0) {
    console.log("\n--- .env'e ekleyin (APP_DATABASE_URL) ---");
    console.log(`Kullanıcı adı: ${ROLE_NAME}`);
    console.log(`Parola: ${password}`);
    console.log("Host/DB kısmını mevcut DATABASE_URL ile aynı tutup yalnızca kullanıcı/parolayı değiştirin.");
  }

  await ownerDb.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});