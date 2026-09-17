import { NextRequest } from "next/server";
import { requireSuperAdmin, isSuperAdminSession } from "@/lib/api/platform-handlers";
import { zodErrorResponse, serviceResultToResponse } from "@/lib/api/handlers";
import { setCompanyStatus } from "@/lib/modules/platform/service";
import { companyStatusInputSchema } from "@/lib/validation/platform";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSuperAdmin();
  if (!isSuperAdminSession(session)) return session;

  const body = await req.json().catch(() => null);
  const parsed = companyStatusInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await setCompanyStatus(session, params.id, parsed.data.status);
  return serviceResultToResponse(result);
}
