import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireWritable, isSession, serviceResultToResponse, zodErrorResponse } from "@/lib/api/handlers";
import { withTenant } from "@/lib/db/tenant-context";
import { createExpenseCategory } from "@/lib/modules/company-settings/service";
import { namedRefInputSchema } from "@/lib/validation/company-settings";

/** SA-05 kategori CRUD'u — liste + oluşturma. */
export async function GET() {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const categories = await withTenant(session.companyId, (tx) =>
    tx.expenseCategory.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  );

  return NextResponse.json({ items: categories });
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const body = await req.json().catch(() => null);
  const parsed = namedRefInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await createExpenseCategory(session, parsed.data.name);
  return serviceResultToResponse(result, 201);
}
