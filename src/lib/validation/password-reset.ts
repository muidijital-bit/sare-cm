import { z } from "zod";

/** KY-03: şifre sıfırlama. */
export const requestPasswordResetSchema = z.object({
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta girin"),
});

export const confirmPasswordResetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(1),
});
