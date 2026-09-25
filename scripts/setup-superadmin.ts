// .env dosyasını manuel yükler — tsx ile doğrudan çalıştırılan betikler (next dev/build'in aksine) .env'i otomatik okumaz.
import "dotenv/config";
/**
 * Gerçek süper admin oluşturur/günceller ve ZORUNLU iki adımlı doğrulamayı (TOTP) kurar.
 *
 *   npx tsx scripts/setup-superadmin.ts --email siz@firma.com [--rotate-2fa] [--no-confirm]
 *
 * - Şifre terminalde GİZLİ girilir (ekrana yazılmaz, sohbete/komut satırına yazmayın).
 *   Otomasyon/test için SUPERADMIN_PASSWORD ortam değişkeni de kabul edilir.
 * - Bir TOTP sırrı üretilir; doğrulama uygulamanıza (Google Authenticator, 1Password, Authy…)
 *   "anahtarı elle gir" ile ekleyin, uygulamadaki 6 haneli kodu girerek onaylayın; onay olmadan kaydedilmez.
 * - Sır veritabanına AES-256-GCM ile şifreli yazılır. Anahtar: TOTP_ENCRYPTION_KEY (yoksa NEXTAUTH_SECRET).
 *   ÖNEMLİ: canlı veritabanı için bu betiği çalıştırırken kullandığınız anahtar, Vercel'deki değerle AYNI olmalı;
 *   aksi halde canlıda 2FA çözülemez ve giriş engellenir.
 */
import { createInterface } from "readline";
import { prisma } from "../src/lib/db/prisma";
import { hashPassword, validatePassword } from "../src/lib/auth/password";
import { encryptTotpSecret, generateTotpSecret, otpauthUri, verifyTotp } from "../src/lib/security/totp";
import { createHash } from "crypto";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(name);

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      const anyRl = rl as unknown as { _writeToOutput: (s: string) => void };
      anyRl._writeToOutput = (s: string) => { if (s.includes(question)) process.stdout.write(s); };
    }
    rl.question(question, (ans) => { rl.close(); if (hidden) process.stdout.write("\n"); resolve(ans); });
  });
}

async function main() {
  const email = (arg("--email") ?? (await ask("Süper admin e-postası: "))).trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Geçerli bir e-posta girin.");

  const host = new URL(process.env.APP_DATABASE_URL!).hostname.split(".")[0];
  const keyFp = createHash("sha256").update(process.env.TOTP_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || "").digest("hex").slice(0, 8);
  console.log(`\nVeritabanı sunucusu: ${host}\nŞifreleme anahtarı parmak izi: ${keyFp} (canlıdaki anahtarla aynı olmalı)\n`);
  if (!has("--no-confirm")) {
    const ok = (await ask(`Bu veritabanına "${email}" için süper admin yazılsın mı? (evet/hayır): `)).trim().toLowerCase();
    if (ok !== "evet") { console.log("İptal edildi."); return; }
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  let password = process.env.SUPERADMIN_PASSWORD;
  if (!password && (!existing || has("--reset-password"))) {
    password = await ask("Yeni şifre (gizli): ", true);
    const again = await ask("Şifre (tekrar): ", true);
    if (password !== again) throw new Error("Şifreler eşleşmiyor.");
  }
  if (password) {
    const check = validatePassword(password);
    if (!check.valid) throw new Error(check.errors.join(" "));
  }

  let encrypted = existing?.twoFactorSecret ?? null;
  if (!encrypted || has("--rotate-2fa")) {
    const secret = generateTotpSecret();
    console.log("\nDoğrulama uygulamanıza EKLEYİN (anahtarı elle gir → zaman tabanlı):");
    console.log(`  Hesap : muiflow (${email})\n  Anahtar: ${secret.match(/.{1,4}/g)!.join(" ")}\n  URI   : ${otpauthUri(email, secret, "muiflow")}\n`);
    if (!has("--no-confirm")) {
      const code = await ask("Uygulamadaki 6 haneli kodu girin: ");
      if (!verifyTotp(secret, code)) throw new Error("Kod yanlış — hiçbir şey kaydedilmedi.");
    }
    encrypted = encryptTotpSecret(secret);
  }

  const data = { isSuperAdmin: true, isActive: true, twoFactorSecret: encrypted, failedLoginCount: 0, lockedUntil: null };
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { ...data, ...(password ? { passwordHash: await hashPassword(password) } : {}) } });
  } else {
    await prisma.user.create({ data: { email, name: "Platform Yöneticisi", passwordHash: await hashPassword(password!), ...data } });
  }
  console.log(`\n✅ Süper admin hazır: ${email} (2FA aktif). Girişte şifre + doğrulama kodu istenecek.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e.message); process.exit(1); });
