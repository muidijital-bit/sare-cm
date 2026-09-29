// .env dosyasını manuel yükler — tsx ile doğrudan çalıştırılan betikler (next dev/build'in aksine) .env'i otomatik okumaz.
import "dotenv/config";
/**
 * Modül kataloğunu ve başlangıç paketlerini tohumlar (idempotent — tekrar çalıştırmak güvenlidir).
 * Mevcut (katalog dışı adlı) paketlere TÜM modüller bağlanır: böylece mevcut şirketler hiçbir
 * modülü kaybetmez.
 */
import { prisma } from "../src/lib/db/prisma";
import { MODULE_CATALOG, DEFAULT_PLANS } from "../src/lib/modules/entitlements/catalog";

// plans/app_modules/plan_modules şirket bazlı DEĞİL (RLS yok) — uzun interaktif transaction yerine
// tek tek/toplu sorgular kullanılır (Neon gecikmesinde 15sn transaction limiti aşılıyordu).
async function main() {
  // Uygulama istemcisi APP_DATABASE_URL'e bağlanır (DATABASE_URL değil) — hangi veritabanına
  // yazıldığı görünür olsun: canlı için APP_DATABASE_URL de canlıya çevrilmeli.
  console.log(`Veritabanı sunucusu: ${new URL(process.env.APP_DATABASE_URL!).hostname.split(".")[0]}`);
  const moduleIds = new Map<string, string>();
  for (const m of MODULE_CATALOG) {
    const row = await prisma.appModule.upsert({
      where: { key: m.key },
      update: { name: m.name, description: m.description, isCore: m.isCore, isFree: m.isFree, sortOrder: m.sortOrder, isActive: m.isActive ?? true },
      create: { ...m, isActive: m.isActive ?? true },
    });
    moduleIds.set(m.key, row.id);
  }

  const defaultNames = DEFAULT_PLANS.map((p) => p.name);
  for (const p of DEFAULT_PLANS) {
    const existing = await prisma.plan.findFirst({ where: { name: p.name } });
    const plan =
      existing ??
      (await prisma.plan.create({
        data: {
          name: p.name, description: p.description, maxUsers: p.maxUsers, maxCustomers: p.maxCustomers,
          maxStorageMb: p.maxStorageMb, price: p.price, yearlyPrice: p.yearlyPrice,
        },
      }));
    await prisma.planModule.createMany({
      data: p.moduleKeys.map((key) => ({ planId: plan.id, moduleId: moduleIds.get(key)! })),
      skipDuplicates: true,
    });
  }

  // Katalog dışı (mevcut) paketler: tüm modüller — mevcut şirketlerin erişimi değişmesin.
  const legacyPlans = await prisma.plan.findMany({ where: { name: { notIn: defaultNames } } });
  for (const plan of legacyPlans) {
    await prisma.planModule.createMany({
      data: Array.from(moduleIds.values()).map((moduleId) => ({ planId: plan.id, moduleId })),
      skipDuplicates: true,
    });
  }
  console.log(`Modüller: ${moduleIds.size}, varsayılan paketler: ${DEFAULT_PLANS.length}, tüm modüllere bağlanan mevcut paket: ${legacyPlans.length}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
