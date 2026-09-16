import { NextResponse } from "next/server";
import { requireSession, isSession } from "@/lib/api/handlers";
import { withTenant } from "@/lib/db/tenant-context";

/** TK-02: katalogdan ürün seçimi için salt-okunur liste. Katalog CRUD'u henüz yapılmadı. */
export async function GET() {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const products = await withTenant(session.companyId, (tx) =>
    tx.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  );

  return NextResponse.json({ items: products });
}
