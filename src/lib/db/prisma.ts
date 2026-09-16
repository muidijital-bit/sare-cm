import { PrismaClient } from "@prisma/client";

// Next.js dev modunda hot-reload her seferinde yeni bir PrismaClient açıp bağlantı
// havuzunu tüketmesin diye global'e tek bir instance cache'lenir (Prisma'nın kendi önerisi).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// ÖNEMLİ: uygulama ÇALIŞMA ZAMANI `APP_DATABASE_URL` (en-az-ayrıcalıklı, NOBYPASSRLS
// `app_user` rolü) ile bağlanır — schema.prisma'daki varsayılan `DATABASE_URL` Neon'da
// sahip (owner) rolüdür ve BYPASSRLS özniteliğine sahiptir, yani onunla bağlanmak RLS'i
// sessizce devre dışı bırakır. Yalnızca `prisma migrate`/`db seed`/admin betikleri
// DATABASE_URL kullanmalıdır. Bkz. scripts/setup-app-role.ts, .env.example.
const appDatabaseUrl = process.env.APP_DATABASE_URL;

if (!appDatabaseUrl && process.env.NODE_ENV !== "test") {
  // eslint-disable-next-line no-console
  console.warn(
    "[db] APP_DATABASE_URL tanımlı değil — DATABASE_URL'e (muhtemelen BYPASSRLS'li sahip " +
      "rolü) düşülüyor. RLS izolasyonu bu bağlantıda ÇALIŞMAYABİLİR. Bkz. scripts/setup-app-role.ts.",
  );
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(appDatabaseUrl ? { datasourceUrl: appDatabaseUrl } : {}),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
