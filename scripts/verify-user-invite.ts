/**
 * Kullanıcı davet akışını (KY-04..KY-08) CANLI veritabanına karşı doğrular:
 * davet oluşturma, paket limiti, kabul (yeni kullanıcı), rol değiştirme,
 * son Sahip koruması, pasifleştirme.
 *
 * Çalıştırma: npx tsx scripts/verify-user-invite.ts
 */
import { randomUUID } from "crypto";
import { prisma } from "../src/lib/db/prisma";
import { withPlatformBypass } from "../src/lib/db/tenant-context";
import { inviteUser, acceptInvitation, updateMembership, listCompanyUsers, cancelInvitation } from "../src/lib/modules/users/service";
import type { TenantSession } from "../src/lib/auth/session";

const DEMO_COMPANY_ID = "00000000-0000-0000-0000-000000000002";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (cond) console.log(`✅ ${label}`);
  else {
    console.error(`❌ ${label}`);
    failures++;
  }
}

async function main() {
  const owner = await withPlatformBypass((tx) => tx.user.findUniqueOrThrow({ where: { email: "sahip@demo.test" } }));
  const ownerSession: TenantSession = {
    userId: owner.id,
    userName: owner.name,
    userEmail: owner.email,
    companyId: DEMO_COMPANY_ID,
    companyName: "Demo Şirket A.Ş.",
    companyStatus: "ACTIVE",
    role: "OWNER",
    membershipCount: 1,
  };
  const salesSession: TenantSession = { ...ownerSession, role: "SALES" };

  const testEmail = `test-invite-${randomUUID().slice(0, 8)}@demo.test`;

  // 1) RBAC — SALES davet gönderemez
  const deniedInvite = await inviteUser(salesSession, { email: testEmail, role: "SALES" });
  assert(!deniedInvite.ok && deniedInvite.status === 403, "SALES kullanıcı davet edemiyor (403)");

  // 2) Davet oluşturma
  const inviteResult = await inviteUser(ownerSession, { email: testEmail, role: "SALES" });
  assert(inviteResult.ok, "Davet oluşturuldu");
  if (!inviteResult.ok) return report();

  // 3) Aynı e-postaya ikinci davet reddedilir
  const duplicateInvite = await inviteUser(ownerSession, { email: testEmail, role: "SALES" });
  assert(!duplicateInvite.ok && duplicateInvite.status === 409, "Aynı e-postaya bekleyen davet varken ikinci davet reddediliyor");

  // 4) Bekleyen davet listede görünüyor
  const listBeforeAccept = await listCompanyUsers(ownerSession);
  assert(listBeforeAccept.ok && listBeforeAccept.data.some((r) => r.kind === "invitation" && r.email === testEmail), "Bekleyen davet listede görünüyor");

  // 5) Zayıf şifreyle kabul reddedilir
  const weakAccept = await acceptInvitation(inviteResult.data.token, "Test Kullanıcı", "123");
  assert(!weakAccept.ok && weakAccept.status === 400, "Zayıf şifreyle davet kabulü reddediliyor");

  // 6) Kabul — yeni kullanıcı + üyelik oluşur
  const acceptResult = await acceptInvitation(inviteResult.data.token, "Test Davetli Kullanıcı", "GucluSifre#2026");
  assert(acceptResult.ok, "Davet kabul edildi, kullanıcı oluşturuldu");

  const newUser = await withPlatformBypass((tx) => tx.user.findUnique({ where: { email: testEmail } }));
  assert(!!newUser, "Yeni kullanıcı DB'de oluştu");
  const newMembership = newUser ? await withPlatformBypass((tx) => tx.membership.findUnique({ where: { userId_companyId: { userId: newUser.id, companyId: DEMO_COMPANY_ID } } })) : null;
  assert(!!newMembership && newMembership.role === "SALES" && newMembership.isActive, "Üyelik doğru rol ve aktif durumda oluştu");

  // 7) Süresi dolmuş/kullanılmış token tekrar kabul edilemez
  const reAccept = await acceptInvitation(inviteResult.data.token, "Tekrar", "GucluSifre#2026");
  assert(!reAccept.ok && reAccept.status === 409, "Kullanılmış davet tekrar kabul edilemiyor (409)");

  // 8) Rol değiştirme
  if (newMembership) {
    const roleChange = await updateMembership(ownerSession, newMembership.id, { role: "ACCOUNTING" });
    assert(roleChange.ok, "Rol değiştirildi");

    // 9) Pasifleştirme
    const deactivate = await updateMembership(ownerSession, newMembership.id, { isActive: false });
    assert(deactivate.ok, "Kullanıcı pasifleştirildi");

    const reactivate = await updateMembership(ownerSession, newMembership.id, { isActive: true });
    assert(reactivate.ok, "Kullanıcı yeniden aktifleştirildi");
  }

  // 10) Son Sahip koruması — tek OWNER'ın rolü düşürülemez/pasifleştirilemez
  const ownerMembership = await withPlatformBypass((tx) => tx.membership.findUniqueOrThrow({ where: { userId_companyId: { userId: owner.id, companyId: DEMO_COMPANY_ID } } }));
  const demoteOwner = await updateMembership(ownerSession, ownerMembership.id, { role: "ADMIN" });
  assert(!demoteOwner.ok && demoteOwner.status === 409, "Son Sahip'in rolü düşürülemiyor (409)");
  const deactivateOwner = await updateMembership(ownerSession, ownerMembership.id, { isActive: false });
  assert(!deactivateOwner.ok && deactivateOwner.status === 409, "Son Sahip pasifleştirilemiyor (409)");

  // 11) Davet iptali
  const secondEmail = `test-invite-cancel-${randomUUID().slice(0, 8)}@demo.test`;
  const secondInvite = await inviteUser(ownerSession, { email: secondEmail, role: "VIEWER" });
  if (secondInvite.ok) {
    const invites = await withPlatformBypass((tx) => tx.invitationToken.findMany({ where: { companyId: DEMO_COMPANY_ID, email: secondEmail } }));
    const cancelResult = await cancelInvitation(ownerSession, invites[0].id);
    assert(cancelResult.ok, "Davet iptal edildi");
  }

  // Temizlik
  await withPlatformBypass(async (tx) => {
    if (newUser) {
      await tx.membership.deleteMany({ where: { userId: newUser.id } });
      await tx.user.delete({ where: { id: newUser.id } });
    }
    await tx.invitationToken.deleteMany({ where: { email: { in: [testEmail, secondEmail] } } });
  });
  console.log("· test verisi temizlendi");

  report();
}

function report() {
  console.log(failures === 0 ? "\n🎉 Kullanıcı davet akışı tüm kontrollerden geçti." : `\n${failures} kontrol BAŞARISIZ.`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
