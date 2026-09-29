import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireWritable, isSession, zodErrorResponse } from "@/lib/api/handlers";
import { inviteUser } from "@/lib/modules/users/service";
import { inviteUserInputSchema } from "@/lib/validation/users";
import { sendInvitationEmail } from "@/lib/email/templates";
import { appBaseUrl } from "@/lib/email/send";

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const body = await req.json().catch(() => null);
  const parsed = inviteUserInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await inviteUser(session, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });

  // Davet e-postayla gider (RESEND_API_KEY tanımlıysa); bağlantı yine de döndürülür — UI'da
  // kopyalanabilir kalır (e-posta spam'e düşerse/gönderilemezse yedek yol).
  const { sent } = await sendInvitationEmail({
    to: parsed.data.email,
    token: result.data.token,
    companyName: session.companyName,
    role: parsed.data.role,
    inviterName: session.userName,
  });
  return NextResponse.json({ token: result.data.token, inviteUrl: `${appBaseUrl()}/davet/${result.data.token}`, expiresAt: result.data.expiresAt, emailSent: sent }, { status: 201 });
}
