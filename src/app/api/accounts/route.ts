import { NextResponse } from "next/server";
import { requireSession, isSession } from "@/lib/api/handlers";
import { withTenant } from "@/lib/db/tenant-context";

/** TH-01: kasa/banka hesabı seçimi için salt-okunur liste. */
export async function GET() {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const accounts = await withTenant(session.companyId, (tx) =>
    tx.account.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  );

  return NextResponse.json({ items: accounts });
}
