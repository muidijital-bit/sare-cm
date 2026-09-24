import { NextRequest } from "next/server";
import { requireSuperAdmin, isSuperAdminSession } from "@/lib/api/platform-handlers";
import { zodErrorResponse, serviceResultToResponse } from "@/lib/api/handlers";
import { getCompanyModules, setCompanyModule } from "@/lib/modules/platform/service";
import { companyModuleInputSchema } from "@/lib/validation/platform";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSuperAdmin();
  if (!isSuperAdminSession(session)) return session;
  return serviceResultToResponse(await getCompanyModules(params.id));
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSuperAdmin();
  if (!isSuperAdminSession(session)) return session;

  const body = await req.json().catch(() => null);
  const parsed = companyModuleInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  return serviceResultToResponse(await setCompanyModule(session, params.id, parsed.data));
}
