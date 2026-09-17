import { NextRequest } from "next/server";
import { requireSession, requireWritable, isSession, serviceResultToResponse, zodErrorResponse } from "@/lib/api/handlers";
import { getCompanySettings, updateCompanySettings } from "@/lib/modules/company-settings/service";
import { companySettingsInputSchema } from "@/lib/validation/company-settings";

export async function GET() {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const result = await getCompanySettings(session);
  return serviceResultToResponse(result);
}

export async function PATCH(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const body = await req.json().catch(() => null);
  const parsed = companySettingsInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await updateCompanySettings(session, parsed.data);
  return serviceResultToResponse(result);
}
