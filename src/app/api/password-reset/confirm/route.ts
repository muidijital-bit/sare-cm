import { NextRequest, NextResponse } from "next/server";
import { confirmPasswordReset } from "@/lib/modules/password-reset/service";
import { confirmPasswordResetSchema } from "@/lib/validation/password-reset";
import { zodErrorResponse } from "@/lib/api/handlers";
import { rateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { allowed } = rateLimit(`password-reset-confirm:${ip}`, RATE_LIMITS.passwordReset.limit, RATE_LIMITS.passwordReset.windowMs);
  if (!allowed) {
    return NextResponse.json({ error: "Çok fazla deneme, lütfen daha sonra tekrar deneyin." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = confirmPasswordResetSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await confirmPasswordReset(parsed.data.token, parsed.data.password);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });

  return NextResponse.json(result.data);
}
