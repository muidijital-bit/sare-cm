import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession, requireWritable, isSession, serviceResultToResponse, zodErrorResponse } from "@/lib/api/handlers";
import { updateCompanyTheme } from "@/lib/modules/company-settings/service";
import { THEME_KEYS } from "@/lib/theme";

const schema = z.object({ theme: z.enum(THEME_KEYS) });

export async function PUT(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  return serviceResultToResponse(await updateCompanyTheme(session, parsed.data.theme));
}
