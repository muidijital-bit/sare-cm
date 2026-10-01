import { NextResponse } from "next/server";
import { requireSession, requireWritable, isSession } from "@/lib/api/handlers";
import { resendInvitation } from "@/lib/modules/users/service";
import { sendInvitationEmail } from "@/lib/email/templates";
import { appBaseUrl } from "@/lib/email/send";

/** Daveti yeniden gönder — yeni bağlantı + e-posta (gönderilemezse bağlantı UI'da gösterilir). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const result = await resendInvitation(session, params.id);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });

  const { sent } = await sendInvitationEmail({
    to: result.data.email,
    token: result.data.token,
    companyName: session.companyName,
    role: result.data.role,
    inviterName: session.userName,
  });
  return NextResponse.json({ inviteUrl: `${appBaseUrl()}/davet/${result.data.token}`, expiresAt: result.data.expiresAt, emailSent: sent });
}
