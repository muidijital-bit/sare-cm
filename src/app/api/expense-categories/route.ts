import { NextResponse } from "next/server";
import { requireSession, isSession } from "@/lib/api/handlers";
import { withTenant } from "@/lib/db/tenant-context";

/** SA-05 kategori CRUD'u Şirket Ayarları modülüne ait, henüz yapılmadı — salt-okunur liste. */
export async function GET() {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const categories = await withTenant(session.companyId, (tx) =>
    tx.expenseCategory.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  );

  return NextResponse.json({ items: categories });
}
