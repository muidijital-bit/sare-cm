import { NextRequest } from "next/server";
import { requireSession, isSession, serviceResultToResponse, zodErrorResponse } from "@/lib/api/handlers";
import { listAuditLogs } from "@/lib/modules/audit/service";
import { listAuditLogsQuerySchema } from "@/lib/validation/audit";

export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const parsed = listAuditLogsQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await listAuditLogs(session, parsed.data);
  return serviceResultToResponse(result);
}
