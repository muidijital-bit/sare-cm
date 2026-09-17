import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireWritable, isSession, zodErrorResponse } from "@/lib/api/handlers";
import { inviteUser } from "@/lib/modules/users/service";
import { inviteUserInputSchema } from "@/lib/validation/users";

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

  // E-posta gönderimi henüz yok (bkz. README) — bağlantı doğrudan döndürülür, UI'da gösterilir/kopyalanır.
  return NextResponse.json({ token: result.data.token, expiresAt: result.data.expiresAt }, { status: 201 });
}
