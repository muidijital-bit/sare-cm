import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db/prisma";
import { LEGAL } from "@/lib/legal";

/** Oturumdaki kullanıcının güncel Kullanım Koşulları / KVKK Aydınlatma sürümünü onaylaması (users RLS'siz). */
export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });

  await prisma.user.update({ where: { id: userId }, data: { termsAcceptedAt: new Date(), termsVersion: LEGAL.version } });
  return NextResponse.json({ ok: true, version: LEGAL.version });
}
