import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireWritable, isSession, serviceResultToResponse, zodErrorResponse } from "@/lib/api/handlers";
import { withTenant } from "@/lib/db/tenant-context";
import { createCustomerSource } from "@/lib/modules/company-settings/service";
import { namedRefInputSchema } from "@/lib/validation/company-settings";

/** MC-03 kaynak seçimi için liste. CRUD'u §SA-04 — Şirket Ayarları modülünden yönetilir. */
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

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const body = await req.json().catch(() => null);
  const parsed = namedRefInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await createCustomerSource(session, parsed.data.name);
  return serviceResultToResponse(result, 201);
}
