import { NextResponse } from "next/server";
import { requireSession, isSession } from "@/lib/api/handlers";
import { withTenant } from "@/lib/db/tenant-context";

/** MC-05 "Sorumlu kullanıcı" seçimi için şirketin aktif üyelerinin listesi. */
export async function GET() {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const memberships = await withTenant(session.companyId, (tx) =>
    tx.membership.findMany({
      where: { isActive: true },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { user: { name: "asc" } },
    }),
  );

  return NextResponse.json({
    items: memberships.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email, role: m.role })),
  });
}
