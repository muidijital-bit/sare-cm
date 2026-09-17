import { prisma } from "@/lib/db/prisma";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { generateSecureToken, PASSWORD_RESET_TOKEN_TTL_MS } from "@/lib/security/tokens";
import { type ServiceResult, notFound, conflict } from "@/lib/modules/result";

/**
 * KY-03: Şifre sıfırlama. `users`/`password_reset_tokens` RLS'e tabi DEĞİLDİR
 * (şirket bazlı değildir, bkz. db-schema-architect notu) — düz `prisma` client'ı kullanılır,
 * `withTenant`/`withPlatformBypass` gerekmez.
 *
 * Kullanıcı numaralandırmasını (var olan e-postayı öğrenmeyi) önlemek için istek her zaman
 * aynı genel mesajla sonuçlanır; e-posta kayıtlı DEĞİLSE token üretilmez ama hata da dönülmez.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return; // e-posta kayıtlı değilse sessizce çık — enumeration önlemi

  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);
  await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } });

  // E-posta gönderimi henüz yok (sağlayıcı kararı bekleniyor — bkz. README). Üretimde bu asla
  // istemciye dönmez; yalnızca geliştirme ortamında sunucu logunda görünür ki akış test edilebilsin.
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log(`[DEV] Şifre sıfırlama bağlantısı (${email}): /sifre-sifirla/${token}`);
  }
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<ServiceResult<{ email: string }>> {
  const passwordCheck = validatePassword(newPassword);
  if (!passwordCheck.valid) return { ok: false, status: 400, message: passwordCheck.errors.join(" ") };

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token }, include: { user: true } });
  if (!resetToken) return notFound("Bağlantı bulunamadı.");
  if (resetToken.usedAt || resetToken.expiresAt <= new Date()) {
    return conflict("Bu bağlantı geçersiz, kullanılmış veya süresi dolmuş.");
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
    prisma.auditLog.create({ data: { companyId: null, userId: resetToken.userId, action: "UPDATE", entityType: "user", entityId: resetToken.userId } }),
  ]);

  return { ok: true, data: { email: resetToken.user.email } };
}
