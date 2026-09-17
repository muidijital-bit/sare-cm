import { NextRequest, NextResponse } from "next/server";
import { acceptInvitation } from "@/lib/modules/users/service";
import { acceptInvitationInputSchema } from "@/lib/validation/users";
import { zodErrorResponse } from "@/lib/api/handlers";
import { rateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

/** KY-04: davet kabul — oturumsuz, public bir uç (§9 oran sınırlaması uygulanır). */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { allowed } = rateLimit(`invitation-accept:${ip}`, RATE_LIMITS.passwordReset.limit, RATE_LIMITS.passwordReset.windowMs);
  if (!allowed) {
    return NextResponse.json({ error: "Çok fazla deneme, lütfen daha sonra tekrar deneyin." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = acceptInvitationInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await acceptInvitation(parsed.data.token, parsed.data.name, parsed.data.password);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });

  return NextResponse.json(result.data);
}
