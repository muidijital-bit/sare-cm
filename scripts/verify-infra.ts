// .env dosyasını manuel yükler — tsx ile doğrudan çalıştırılan betikler (next dev/build'in aksine) .env'i otomatik okumaz.
import "dotenv/config";

/**
 * Tek seferlik doğrulama betiği — CANLI Neon veritabanına karşı temel altyapının
 * gerçekten çalıştığını kanıtlar. Kalıcı bir proje betiği değildir; RLS izolasyonunu,
 * şifre doğrulamasını ve RBAC matrisini uçtan uca kontrol eder.
 *
 * Çalıştırma: npx tsx scripts/verify-infra.ts
 */
import { randomUUID } from "crypto";
import { prisma } from "../src/lib/db/prisma";
import { withTenant, withPlatformBypass } from "../src/lib/db/tenant-context";
import { verifyPassword } from "../src/lib/auth/password";
import { can } from "../src/lib/auth/rbac";

const DEMO_COMPANY_ID = "00000000-0000-0000-0000-000000000002";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (cond) {
    console.log(`✅ ${label}`);
  } else {
    console.error(`❌ ${label}`);
    failures++;
  }
}

async function main() {
  // 1) Şifre doğrulama — seed'de oluşturulan sahip kullanıcı
  const owner = await withPlatformBypass((tx) => tx.user.findUnique({ where: { email: "sare@demo.test" } }));
  assert(!!owner, "Seed'deki sahip kullanıcı bulunuyor");
  if (owner) {
    const ok = await verifyPassword("DemoSifre#2026", owner.passwordHash);
    const bad = await verifyPassword("yanlis-sifre", owner.passwordHash);
    assert(ok, "Doğru şifre doğrulanıyor");
    assert(!bad, "Yanlış şifre reddediliyor");
  }

  // 2) RLS izolasyonu — ikinci bir şirket ve müşteri oluştur, birinci şirket bağlamından
  //    görülüp görülmediğini test et.
  const otherCompanyId = randomUUID();
  await withPlatformBypass(async (tx) => {
    const plan = await tx.plan.findFirstOrThrow();
    await tx.company.create({
      data: { id: otherCompanyId, name: "İzolasyon Test Şirketi", planId: plan.id, status: "ACTIVE" },
    });
    await tx.customer.create({
      data: {
        companyId: otherCompanyId,
        type: "CORPORATE",
        title: "Öteki Şirketin Müşterisi",
        createdBy: owner!.id,
      },
    });
  });
  console.log("· izolasyon test verisi oluşturuldu (Şirket B + 1 müşteri)");

  const seenFromCompanyA = await withTenant(DEMO_COMPANY_ID, (tx) => tx.customer.findMany());
  assert(
    seenFromCompanyA.every((c) => c.companyId === DEMO_COMPANY_ID),
    "Şirket A bağlamında yalnızca Şirket A'nın müşterileri görünüyor",
  );
  assert(
    seenFromCompanyA.every((c) => c.title !== "Öteki Şirketin Müşterisi"),
    "Şirket B'nin müşterisi Şirket A'nın sorgusunda GÖRÜNMÜYOR (RLS çalışıyor)",
  );

  const seenFromCompanyB = await withTenant(otherCompanyId, (tx) => tx.customer.findMany());
  assert(
    seenFromCompanyB.length === 1 && seenFromCompanyB[0].title === "Öteki Şirketin Müşterisi",
    "Şirket B bağlamında yalnızca kendi müşterisi görünüyor",
  );

  // Doğrudan ID ile çapraz-şirket erişim denemesi (RLS + uygulama filtresi)
  const crossAccessAttempt = await withTenant(DEMO_COMPANY_ID, (tx) =>
    tx.customer.findFirst({ where: { companyId: otherCompanyId } }),
  );
  assert(crossAccessAttempt === null, "Şirket A, Şirket B'nin kaydına company_id belirterek dahi erişemiyor");

  // Temizlik
  await withPlatformBypass(async (tx) => {
    await tx.customer.deleteMany({ where: { companyId: otherCompanyId } });
    await tx.company.delete({ where: { id: otherCompanyId } });
  });
  console.log("· izolasyon test verisi temizlendi");

  // 3) RBAC matrisi — birkaç temsili örnek
  assert(can("SALES", "customer", "edit", { ownerUserId: "u1", userId: "u1" }), "SALES kendi müşterisini düzenleyebilir");
  assert(!can("SALES", "customer", "edit", { ownerUserId: "u1", userId: "u2" }), "SALES başkasının müşterisini düzenleyemez");
  assert(!can("SALES", "expense", "view"), "SALES gider modülünü hiç göremez");
  assert(can("ACCOUNTING", "expense", "delete"), "ACCOUNTING gideri silebilir (Tam)");
  assert(!can("VIEWER", "customer", "edit"), "VIEWER hiçbir şeyi düzenleyemez");
  assert(can("OWNER", "userManagement", "delete"), "OWNER kullanıcı yönetiminde tam yetkili");
  assert(!can("ADMIN", "userManagement", "delete"), "ADMIN kullanıcı silemez (yalnızca ekle/düzenle)");

  console.log(failures === 0 ? "\n🎉 Tüm kontroller geçti." : `\n${failures} kontrol BAŞARISIZ.`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });