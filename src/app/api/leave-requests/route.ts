import { NextRequest } from "next/server";
import { requireSession, requireWritable, isSession, serviceResultToResponse, zodErrorResponse } from "@/lib/api/handlers";
import { createLeaveRequest } from "@/lib/modules/employees/service";
import { leaveRequestInputSchema } from "@/lib/validation/employee";

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const body = await req.json().catch(() => null);
  const parsed = leaveRequestInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await createLeaveRequest(session, parsed.data);
  return serviceResultToResponse(result, 201);
}
