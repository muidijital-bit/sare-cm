import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, isSuperAdminSession } from "@/lib/api/platform-handlers";
import { zodErrorResponse, serviceResultToResponse } from "@/lib/api/handlers";
import { listCompanies, createCompany } from "@/lib/modules/platform/service";
import { createCompanyInputSchema } from "@/lib/validation/platform";

export async function GET() {
  const session = await requireSuperAdmin();
  if (!isSuperAdminSession(session)) return session;

  const companies = await listCompanies();
  return NextResponse.json({ items: companies });
}

export async function POST(req: NextRequest) {
  const session = await requireSuperAdmin();
  if (!isSuperAdminSession(session)) return session;

  const body = await req.json().catch(() => null);
  const parsed = createCompanyInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await createCompany(session, parsed.data);
  return serviceResultToResponse(result, 201);
}
