import { NextResponse } from "next/server";
import { requireSession, isSession } from "@/lib/api/handlers";
import { withTenant } from "@/lib/db/tenant-context";

/**
 * MC-03 kaynak seçimi için salt-okunur liste. Kaynakların CRUD'u Şirket Ayarları
 * modülüne ait (§SA-04) — henüz yapılmadı; bu uç yalnızca dropdown'u besler.
 */
export async function GET() {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const sources = await withTenant(session.companyId, (tx) =>
    tx.customerSource.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  );

  return NextResponse.json({ items: sources });
}
