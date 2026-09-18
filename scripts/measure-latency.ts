// .env dosyasını manuel yükler — tsx ile doğrudan çalıştırılan betikler (next dev/build'in aksine) .env'i otomatik okumaz.
import "dotenv/config";

/** Neon'a giden gerçek withTenant() çağrısının süresini ölçer (ısınmış bağlantı). */
import { prisma } from "../src/lib/db/prisma";
import { withTenant } from "../src/lib/db/tenant-context";

const DEMO_COMPANY_ID = "00000000-0000-0000-0000-000000000002";

async function timed(label: string, fn: () => Promise<unknown>) {
  const start = Date.now();
  await fn();
  console.log(`${label}: ${Date.now() - start}ms`);
}

async function main() {
  await timed("Isınma sorgusu", () => prisma.$queryRaw`SELECT 1`);
  await timed("withTenant (gerçek fonksiyon) — boş sorgu", () => withTenant(DEMO_COMPANY_ID, (tx) => tx.$queryRaw`SELECT 1`));
  await timed("withTenant (gerçek fonksiyon) — customer.findMany", () => withTenant(DEMO_COMPANY_ID, (tx) => tx.customer.findMany({ take: 20 })));
  await timed("withTenant (gerçek fonksiyon) — tekrar", () => withTenant(DEMO_COMPANY_ID, (tx) => tx.customer.findMany({ take: 20 })));
}

main().finally(() => prisma.$disconnect());