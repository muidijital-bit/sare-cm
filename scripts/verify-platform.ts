/**
 * Platform (süper admin) modülünü — yeni şirket oluşturma, paket, askıya alma —
 * CANLI veritabanına karşı doğrular. Çalıştırma: npx tsx scripts/verify-platform.ts
 */
import { randomUUID } from "crypto";
import { prisma } from "../src/lib/db/prisma";
import { withPlatformBypass } from "../src/lib/db/tenant-context";
import { createPlan, createCompany, listCompanies, setCompanyStatus } from "../src/lib/modules/platform/service";
import { acceptInvitation } from "../src/lib/modules/users/service";
import type { SuperAdminSession } from "../src/lib/auth/session";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (cond) console.log(`✅ ${label}`);
  else {
    console.error(`❌ ${label}`);
    failures++;
  }
}

async function main() {
  const superAdmin = await withPlatformBypass(async (tx) => {
    const existing = await tx.user.findFirst({ where: { isSuperAdmin: true } });
    if (existing) return existing;
    return tx.user.create({ data: { email: `superadmin-${randomUUID().slice(0, 6)}@platform.test`, name: "Test Süper Admin", passwordHash: "x", isActive: true, isSuperAdmin: true } });
  });
  const adminSession: SuperAdminSession = { userId: superAdmin.id };

  // 1) Paket oluşturma
  const plan = await createPlan(adminSession, { name: `Test Paket ${randomUUID().slice(0, 6)}`, maxUsers: 3, maxCustomers: 50, maxStorageMb: 256, price: 199 });
  assert(!!plan.id, "Paket oluşturuldu");

  // 2) Yeni şirket oluşturma — davet token'ı döner
  const ownerEmail = `platform-test-owner-${randomUUID().slice(0, 8)}@demo.test`;
  const companyResult = await createCompany(adminSession, { name: `Platform Test Şirket ${randomUUID().slice(0, 6)}`, ownerEmail, planId: plan.id, subscriptionEndsAt: null });
  assert(companyResult.ok, "Yeni şirket + Sahip daveti oluşturuldu");
  if (!companyResult.ok) return report();

  // 3) Şirket listede görünüyor
  const companies = await listCompanies();
  assert(companies.some((c) => c.id === companyResult.data.companyId), "Yeni şirket listede görünüyor");

  // 4) Davet kabul edilip Sahip kullanıcı+üyelik oluşuyor (mevcut kullanıcı davet akışıyla aynı mekanizma)
  const acceptResult = await acceptInvitation(companyResult.data.inviteToken, "Platform Test Sahip", "GucluSifre#2026");
  assert(acceptResult.ok, "Şirketin ilk Sahip daveti kabul edildi");

  const newOwner = await withPlatformBypass((tx) => tx.user.findUnique({ where: { email: ownerEmail } }));
  const newMembership = newOwner ? await withPlatformBypass((tx) => tx.membership.findUnique({ where: { userId_companyId: { userId: newOwner.id, companyId: companyResult.data.companyId } } })) : null;
  assert(!!newMembership && newMembership.role === "OWNER", "Yeni kullanıcı şirkette OWNER rolüyle üye");

  // 5) Askıya alma / aktifleştirme
  const suspend = await setCompanyStatus(adminSession, companyResult.data.companyId, "SUSPENDED");
  assert(suspend.ok, "Şirket askıya alındı");
  const suspendAgain = await setCompanyStatus(adminSession, companyResult.data.companyId, "SUSPENDED");
  assert(!suspendAgain.ok && suspendAgain.status === 409, "Zaten askıdaki şirket tekrar askıya alınamıyor (409)");
  const activate = await setCompanyStatus(adminSession, companyResult.data.companyId, "ACTIVE");
  assert(activate.ok, "Şirket yeniden aktifleştirildi");

  const companyRow = await withPlatformBypass((tx) => tx.company.findUniqueOrThrow({ where: { id: companyResult.data.companyId } }));
  assert(companyRow.status === "ACTIVE", "Şirket durumu doğru şekilde güncel");

  // 6) Veri silinmedi — askıya alma/aktifleştirme sırasında müşteri verisi korunuyor mu kontrolü
  //    (bu test şirketinde müşteri yok, ama update işleminin yalnızca `status` alanını
  //    değiştirdiğini ve `deletedAt`i etkilemediğini doğruluyoruz)
  assert(companyRow.deletedAt === null, "Şirket verisi silinmedi (deletedAt hâlâ null)");

  // Temizlik
  await withPlatformBypass(async (tx) => {
    if (newOwner) {
      await tx.membership.deleteMany({ where: { userId: newOwner.id } });
      await tx.user.delete({ where: { id: newOwner.id } });
    }
    await tx.invitationToken.deleteMany({ where: { companyId: companyResult.data.companyId } });
    await tx.company.delete({ where: { id: companyResult.data.companyId } });
    await tx.plan.delete({ where: { id: plan.id } });
  });
  console.log("· test verisi temizlendi");

  report();
}

function report() {
  console.log(failures === 0 ? "\n🎉 Platform modülü tüm kontrollerden geçti." : `\n${failures} kontrol BAŞARISIZ.`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
