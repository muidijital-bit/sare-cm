// .env dosyasını manuel yükler — tsx ile doğrudan çalıştırılan betikler (next dev/build'in aksine) .env'i otomatik okumaz.
import "dotenv/config";

/**
 * Şifre sıfırlama akışını (KY-03) CANLI veritabanına karşı doğrular.
 * Çalıştırma: npx tsx scripts/verify-password-reset.ts
 */
import { randomUUID } from "crypto";
import { prisma } from "../src/lib/db/prisma";
import { requestPasswordReset, confirmPasswordReset } from "../src/lib/modules/password-reset/service";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (cond) console.log(`✅ ${label}`);
  else {
    console.error(`❌ ${label}`);
    failures++;
  }
}

async function main() {
  const testEmail = `test-reset-${randomUUID().slice(0, 8)}@demo.test`;
  const originalHash = await hashPassword("EskiSifre#2026");
  const testUser = await prisma.user.create({ data: { email: testEmail, name: "Test Reset Kullanıcı", passwordHash: originalHash, isActive: true } });

  // 1) Var olmayan e-posta — sessizce hiçbir şey olmaz, hata fırlatmaz, token da oluşmaz
  const tokenCountBefore = await prisma.passwordResetToken.count();
  await requestPasswordReset("olmayan-bir-eposta@demo.test");
  const tokenCountAfter = await prisma.passwordResetToken.count();
  assert(tokenCountAfter === tokenCountBefore, "Var olmayan e-posta için token oluşturulmuyor (enumeration önlemi)");

  // 2) Var olan e-posta — token oluşur
  await requestPasswordReset(testEmail);
  const tokenRow = await prisma.passwordResetToken.findFirst({ where: { userId: testUser.id }, orderBy: { createdAt: "desc" } });
  assert(!!tokenRow, "Kayıtlı e-posta için sıfırlama token'ı oluşturuldu");
  if (!tokenRow) return report();

  // 3) Zayıf şifre reddedilir
  const weakResult = await confirmPasswordReset(tokenRow.token, "123");
  assert(!weakResult.ok && weakResult.status === 400, "Zayıf şifre reddediliyor");

  // 4) Geçerli şifreyle sıfırlama başarılı
  const confirmResult = await confirmPasswordReset(tokenRow.token, "YeniGucluSifre#2026");
  assert(confirmResult.ok, "Şifre başarıyla sıfırlandı");

  const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: testUser.id } });
  const oldPasswordStillWorks = await verifyPassword("EskiSifre#2026", updatedUser.passwordHash);
  const newPasswordWorks = await verifyPassword("YeniGucluSifre#2026", updatedUser.passwordHash);
  assert(!oldPasswordStillWorks, "Eski şifre artık çalışmıyor");
  assert(newPasswordWorks, "Yeni şifre çalışıyor");

  // 5) Kullanılmış token tekrar kullanılamaz
  const reuseResult = await confirmPasswordReset(tokenRow.token, "BaskaSifre#2026");
  assert(!reuseResult.ok && reuseResult.status === 409, "Kullanılmış token tekrar kullanılamıyor (409)");

  // 6) Süresi dolmuş token reddedilir
  const expiredToken = await prisma.passwordResetToken.create({
    data: { userId: testUser.id, token: randomUUID(), expiresAt: new Date(Date.now() - 1000) },
  });
  const expiredResult = await confirmPasswordReset(expiredToken.token, "StillGucluSifre#2026");
  assert(!expiredResult.ok && expiredResult.status === 409, "Süresi dolmuş token reddediliyor (409)");

  // Temizlik
  await prisma.passwordResetToken.deleteMany({ where: { userId: testUser.id } });
  await prisma.user.delete({ where: { id: testUser.id } });
  console.log("· test verisi temizlendi");

  report();
}

function report() {
  console.log(failures === 0 ? "\n🎉 Şifre sıfırlama akışı tüm kontrollerden geçti." : `\n${failures} kontrol BAŞARISIZ.`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());