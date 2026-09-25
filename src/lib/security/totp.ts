import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * TOTP (RFC 6238) — süper admin 2FA'sı için. Harici bağımlılık yok: HMAC-SHA1, 30 sn adım, 6 hane.
 * Sırlar veritabanında AES-256-GCM ile şifreli tutulur (anahtar: TOTP_ENCRYPTION_KEY, yoksa
 * NEXTAUTH_SECRET) — böylece yalnızca veritabanı sızarsa ikinci faktör de düşmez.
 */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpAt(secretBase32: string, timeMs: number, digits = TOTP_DIGITS): string {
  const counter = Math.floor(timeMs / 1000 / TOTP_STEP_SECONDS);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", base32Decode(secretBase32)).update(msg).digest();
  const offset = h[h.length - 1] & 0xf;
  const bin = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}

/** Girilen kodu ±1 adım (saat sapması) toleransıyla, sabit zamanlı karşılaştırarak doğrular. */
export function verifyTotp(secretBase32: string, code: string, nowMs = Date.now()): boolean {
  const cleaned = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;
  let ok = false;
  for (const drift of [-1, 0, 1]) {
    const expected = Buffer.from(totpAt(secretBase32, nowMs + drift * TOTP_STEP_SECONDS * 1000));
    const given = Buffer.from(cleaned);
    if (expected.length === given.length && timingSafeEqual(expected, given)) ok = true;
  }
  return ok;
}

export function otpauthUri(accountEmail: string, secretBase32: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;
}

function encryptionKey(): Buffer {
  const raw = process.env.TOTP_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
  if (!raw) throw new Error("TOTP_ENCRYPTION_KEY veya NEXTAUTH_SECRET tanımlı olmalı.");
  return createHash("sha256").update(raw).digest();
}

/** Biçim: v1:<iv b64>:<tag b64>:<şifreli b64> */
export function encryptTotpSecret(secretBase32: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([c.update(secretBase32, "utf8"), c.final()]);
  return `v1:${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${enc.toString("base64")}`;
}

/** Çözülemezse (yanlış anahtar/bozuk veri) null döner — çağıran giriş engeller. */
export function decryptTotpSecret(stored: string): string | null {
  try {
    const [v, iv, tag, enc] = stored.split(":");
    if (v !== "v1") return null;
    const d = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(enc, "base64")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
