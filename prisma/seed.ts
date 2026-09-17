/**
 * Geliştirme ortamı için başlangıç verisi. Çalıştırma: `npm run db:seed`
 * (package.json "prisma.seed" alanı `npx prisma db seed` tarafından da kullanılır).
 *
 * `withPlatformBypass` kullanır: `FORCE ROW LEVEL SECURITY` tablo sahibi rolünü de
 * kapsadığından (bkz. prisma/sql/001_row_level_security.sql), bypass olmadan hiçbir
 * INSERT RLS'i geçemez. Uygulama kodu bu deseni ASLA taklit etmemelidir — yalnızca
 * güvenilir, tek seferlik betikler (seed, platform admin işlemleri) kullanır.
 *
 * Not: Her adım AYRI KISA bir `withPlatformBypass` transaction'ı içinde çalışır (tek bir
 * uzun transaction yerine). Neon'un pooled ucunda, gecikmeli bir ağdan uzun süre açık
 * tutulan tek bir transaction sunucu tarafından kapatılabiliyor (P1017); adımları
 * kısa/bağımsız tutmak buna karşı dayanıklılık sağlıyor. Betik idempotent (upsert)
 * olduğundan güvenle yeniden çalıştırılabilir. Gerçek istek işleme kodu bu deseni
 * taklit etmez — ilişkili bir iş işlemi tek transaction'da atomik kalmalıdır.
 */
import { hashPassword } from "../src/lib/auth/password";
import { prisma } from "../src/lib/db/prisma";
import { withPlatformBypass } from "../src/lib/db/tenant-context";

async function main() {
  console.log("Seed başlıyor...");

  const starterPlan = await withPlatformBypass((tx) =>
    tx.plan.upsert({
      where: { id: "00000000-0000-0000-0000-000000000001" },
      update: {},
      create: {
        id: "00000000-0000-0000-0000-000000000001",
        name: "Başlangıç",
        maxUsers: 5,
        maxCustomers: 500,
        maxStorageMb: 1024,
        price: 0,
      },
    }),
  );
  console.log("· plan hazır");

  const demoCompany = await withPlatformBypass((tx) =>
    tx.company.upsert({
      where: { id: "00000000-0000-0000-0000-000000000002" },
      update: {},
      create: {
        id: "00000000-0000-0000-0000-000000000002",
        name: "Demo Şirket A.Ş.",
        status: "ACTIVE",
        planId: starterPlan.id,
        defaultVatRate: 20,
        quoteValidityDays: 15,
      },
    }),
  );
  console.log("· şirket hazır");

  const ownerPasswordHash = await hashPassword("DemoSifre#2026");
  const owner = await withPlatformBypass((tx) =>
    tx.user.upsert({
      where: { email: "sahip@demo.test" },
      // Görünen ad "Demo Sahip" gibi kalmasın diye re-seed'de de düzeltilir — giriş bilgileri
      // (e-posta/şifre) sabit kalır, yalnızca kullanıcıya gösterilen ad güncellenir.
      update: { name: "Merve Kaplan" },
      create: {
        email: "sahip@demo.test",
        name: "Merve Kaplan",
        passwordHash: ownerPasswordHash,
        isActive: true,
      },
    }),
  );
  console.log("· sahip kullanıcı hazır");

  await withPlatformBypass((tx) =>
    tx.membership.upsert({
      where: { userId_companyId: { userId: owner.id, companyId: demoCompany.id } },
      update: { role: "OWNER", isActive: true },
      create: { userId: owner.id, companyId: demoCompany.id, role: "OWNER", isActive: true },
    }),
  );
  console.log("· üyelik hazır");

  for (const name of ["Web sitesi", "Referans"]) {
    await withPlatformBypass((tx) =>
      tx.customerSource.upsert({
        where: { companyId_name: { companyId: demoCompany.id, name } },
        update: {},
        create: { companyId: demoCompany.id, name },
      }),
    );
  }
  console.log("· müşteri kaynakları hazır");

  for (const name of ["Kira", "Abonelik/Yazılım"]) {
    await withPlatformBypass((tx) =>
      tx.expenseCategory.upsert({
        where: { companyId_name: { companyId: demoCompany.id, name } },
        update: {},
        create: { companyId: demoCompany.id, name },
      }),
    );
  }
  console.log("· gider kategorileri hazır");

  await withPlatformBypass((tx) =>
    tx.account.upsert({
      where: { id: "00000000-0000-0000-0000-000000000010" },
      update: {},
      create: {
        id: "00000000-0000-0000-0000-000000000010",
        companyId: demoCompany.id,
        name: "Ana Kasa",
        type: "CASH",
      },
    }),
  );
  console.log("· kasa hesabı hazır");

  const superAdminPasswordHash = await hashPassword("SuperAdmin#2026");
  await withPlatformBypass((tx) =>
    tx.user.upsert({
      where: { email: "admin@platform.test" },
      update: { isSuperAdmin: true },
      create: {
        email: "admin@platform.test",
        name: "Platform Admin",
        passwordHash: superAdminPasswordHash,
        isActive: true,
        isSuperAdmin: true,
      },
    }),
  );
  console.log("· süper admin hazır");

  console.log("Seed tamamlandı.");
  console.log(`Şirket girişi: sahip@demo.test / DemoSifre#2026 (şirket: ${demoCompany.name})`);
  console.log("Platform (süper admin) girişi: admin@platform.test / SuperAdmin#2026 → /platform");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
