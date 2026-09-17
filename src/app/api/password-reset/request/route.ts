import { NextRequest, NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/modules/password-reset/service";
import { requestPasswordResetSchema } from "@/lib/validation/password-reset";
import { zodErrorResponse } from "@/lib/api/handlers";
import { rateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

/**
 * KY-03: public uç, §9 oran sınırlaması uygulanır. Yanıt HER ZAMAN aynı jenerik mesajdır —
 * e-postanın kayıtlı olup olmadığı asla açığa çıkmaz (enumeration önlemi).
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { allowed } = rateLimit(`password-reset:${ip}`, RATE_LIMITS.passwordReset.limit, RATE_LIMITS.passwordReset.windowMs);
  if (!allowed) {
    return NextResponse.json({ error: "Çok fazla deneme, lütfen daha sonra tekrar deneyin." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = requestPasswordResetSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  await requestPasswordReset(parsed.data.email);

  return NextResponse.json({ message: "Bu e-posta kayıtlıysa bir sıfırlama bağlantısı gönderildi." });
}
