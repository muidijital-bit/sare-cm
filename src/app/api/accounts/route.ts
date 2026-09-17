import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireWritable, isSession, serviceResultToResponse, zodErrorResponse } from "@/lib/api/handlers";
import { withTenant } from "@/lib/db/tenant-context";
import { createAccount } from "@/lib/modules/company-settings/service";
import { accountInputSchema } from "@/lib/validation/company-settings";

/** SA-06 kasa/banka hesabı — liste + oluşturma. */
export async function GET() {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const accounts = await withTenant(session.companyId, (tx) =>
    tx.account.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  );

  return NextResponse.json({ items: accounts });
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const body = await req.json().catch(() => null);
  const parsed = accountInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await createAccount(session, parsed.data.name, parsed.data.type);
  return serviceResultToResponse(result, 201);
}
