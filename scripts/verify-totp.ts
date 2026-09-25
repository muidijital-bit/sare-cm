import "dotenv/config";
import { base32Encode, base32Decode, totpAt, verifyTotp, generateTotpSecret, encryptTotpSecret, decryptTotpSecret } from "../src/lib/security/totp";

let failures = 0;
const check = (l: string, c: boolean) => { console.log(`${c ? "✅" : "❌"} ${l}`); if (!c) failures++; };

// RFC 6238 Ek-B test vektörleri (SHA1, sır "12345678901234567890"), 6 haneli karşılıkları
const secret = base32Encode(Buffer.from("12345678901234567890"));
for (const [t, code] of [[59, "287082"], [1111111109, "081804"], [1111111111, "050471"], [1234567890, "005924"], [2000000000, "279037"]] as const) {
  check(`RFC 6238 vektörü T=${t} → ${code}`, totpAt(secret, t * 1000) === code);
}
check("base32 gidiş-dönüş", base32Decode(base32Encode(Buffer.from("merhaba dünya"))).toString() === "merhaba dünya");
const s = generateTotpSecret();
const now = Date.now();
check("doğru kod kabul", verifyTotp(s, totpAt(s, now), now));
check("±1 adım tolerans", verifyTotp(s, totpAt(s, now - 30000), now) && verifyTotp(s, totpAt(s, now + 30000), now));
check("2 adım sapma RED", !verifyTotp(s, totpAt(s, now - 90000), now));
check("yanlış kod RED", !verifyTotp(s, "000000", now) || totpAt(s, now) === "000000");
check("biçim hatalı RED (5 hane, harf)", !verifyTotp(s, "12345", now) && !verifyTotp(s, "abcdef", now));
const enc = encryptTotpSecret(s);
check("şifreleme: düz sır saklanmıyor", !enc.includes(s));
check("şifre çözme doğru", decryptTotpSecret(enc) === s);
check("bozuk veri → null", decryptTotpSecret(enc.slice(0, -4) + "AAAA") === null);
const saved = process.env.NEXTAUTH_SECRET, savedK = process.env.TOTP_ENCRYPTION_KEY;
delete process.env.TOTP_ENCRYPTION_KEY; process.env.NEXTAUTH_SECRET = "baska-anahtar";
check("yanlış anahtar → null", decryptTotpSecret(enc) === null);
process.env.NEXTAUTH_SECRET = saved; if (savedK) process.env.TOTP_ENCRYPTION_KEY = savedK;
console.log(failures === 0 ? "\nTOTP TESTLERİ GEÇTİ" : `\n${failures} BAŞARISIZ`); process.exit(failures ? 1 : 0);
