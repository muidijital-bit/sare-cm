import bcrypt from "bcryptjs";

/** §KY-02 Şifre kuralları: min. 10 karakter + yaygın şifre kontrolü. */
const MIN_LENGTH = 10;

// Küçük, yerleşik bir "yaygın şifre" kara listesi. V1 kapsamı için yeterlidir;
// gerekirse haveibeenpwned gibi bir servisle genişletilebilir (V1.5+).
const COMMON_PASSWORDS = new Set([
  "12345678910",
  "1234567890",
  "password123",
  "qwertyuiop",
  "asdfghjkl1",
  "sifre123456",
  "parola12345",
  "123456789012",
]);

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < MIN_LENGTH) {
    errors.push(`Şifre en az ${MIN_LENGTH} karakter olmalıdır.`);
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push("Bu şifre çok yaygın kullanıldığı için güvenli değil.");
  }
  if (/^(.)\1+$/.test(password)) {
    errors.push("Şifre tek bir karakterin tekrarından oluşamaz.");
  }

  return { valid: errors.length === 0, errors };
}

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
