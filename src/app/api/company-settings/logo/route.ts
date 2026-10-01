import { NextRequest } from "next/server";
import { requireSession, requireWritable, isSession, serviceResultToResponse, zodErrorResponse } from "@/lib/api/handlers";
import { updateCompanyLogo } from "@/lib/modules/company-settings/service";
import { companyLogoInputSchema } from "@/lib/validation/company-settings";

export async function PUT(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const parsed = companyLogoInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  return serviceResultToResponse(await updateCompanyLogo(session, parsed.data.logoUrl));
}
