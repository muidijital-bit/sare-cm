// .env dosyasını manuel yükler — tsx ile doğrudan çalıştırılan betikler (next dev/build'in aksine) .env'i otomatik okumaz.
import "dotenv/config";
/**
 * SALT-OKUNUR teşhis: bir süper adminin 2FA kaydı var mı ve verilen anahtarla çözülebiliyor mu?
 * "İki adımlı doğrulama kurulu değil" hatasının sebebini (kayıt yok / anahtar uyuşmuyor) ayırır.
 *
 *   npx tsx scripts/check-superadmin-2fa.ts --email siz@firma.com
 *
 * Hiçbir şey yazmaz; sırrın kendisini ekrana basmaz.
 */
import { createHash } from "crypto";
import { prisma } from "../src/lib/db/prisma";
import { decryptTotpSecret } from "../src/lib/security/totp";

async function main() {
  const i = process.argv.indexOf("--email");
  const email = (i >= 0 ? process.argv[i + 1] : "")?.trim().toLowerCase();
  if (!email) throw new Error("--email gerekli.");

  const raw = process.env.TOTP_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || "";
  const host = new URL(process.env.APP_DATABASE_URL!).hostname.split(".")[0];
  console.log(`Veritabanı sunucusu : ${host}`);
  console.log(`Anahtar kaynağı     : ${process.env.TOTP_ENCRYPTION_KEY ? "TOTP_ENCRYPTION_KEY" : "NEXTAUTH_SECRET"}`);
  console.log(`Anahtar uzunluğu    : ${raw.length} karakter${raw !== raw.trim() ? " (UYARI: başında/sonunda boşluk var)" : ""}`);
  console.log(`Anahtar parmak izi  : ${createHash("sha256").update(raw).digest("hex").slice(0, 8)}`);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { isSuperAdmin: true, isActive: true, twoFactorSecret: true, lockedUntil: true },
  });
  if (!user) {
    console.log(`\nSONUÇ: "${email}" bu veritabanında YOK.`);
    return;
  }
  console.log(`\nSüper admin         : ${user.isSuperAdmin ? "evet" : "HAYIR"}`);
  console.log(`Aktif               : ${user.isActive ? "evet" : "HAYIR"}`);
  console.log(`Kilitli             : ${user.lockedUntil && user.lockedUntil > new Date() ? "EVET" : "hayır"}`);
  console.log(`2FA kaydı           : ${user.twoFactorSecret ? "var" : "YOK"}`);
  if (user.twoFactorSecret) {
    const ok = decryptTotpSecret(user.twoFactorSecret) !== null;
    console.log(`Bu anahtarla çözülüyor: ${ok ? "EVET" : "HAYIR"}`);
    console.log(
      ok
        ? "\nSONUÇ: Kayıt sağlam. Canlı hâlâ hata veriyorsa Vercel'deki TOTP_ENCRYPTION_KEY bu değerle aynı değil ya da Redeploy yapılmadı."
        : "\nSONUÇ: Kayıt bu anahtarla ŞİFRELENMEMİŞ — setup betiğini bu anahtarla --rotate-2fa ile yeniden çalıştırın.",
    );
  } else {
    console.log("\nSONUÇ: 2FA hiç kaydedilmemiş — setup betiği tamamlanmamış; yeniden çalıştırın.");
  }
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
