import { randomBytes } from "crypto";

/** KY-03/KY-04: davet ve şifre sıfırlama token'ları için kriptografik olarak güvenli rastgele değer. */
export function generateSecureToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** KY-04: davet linki 72 saat geçerli. */
export const INVITATION_TOKEN_TTL_MS = 72 * 60 * 60 * 1000;

/** KY-03: şifre sıfırlama linki — davetten daha kısa ömürlü tutulur. */
export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 saat
