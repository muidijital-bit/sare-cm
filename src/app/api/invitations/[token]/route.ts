import { NextResponse } from "next/server";
import { getInvitationInfo } from "@/lib/modules/users/service";

/** Davet kabul sayfası (public, oturumsuz) için davet bilgisini döner. */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const info = await getInvitationInfo(params.token);
  if (!info) {
    return NextResponse.json({ error: "Davet bulunamadı." }, { status: 404 });
  }
  return NextResponse.json(info);
}
