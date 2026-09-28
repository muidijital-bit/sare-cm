import { NextRequest } from "next/server";
import { requireSession, requireWritable, isSession, serviceResultToResponse } from "@/lib/api/handlers";
import { deleteLeaveRequest } from "@/lib/modules/employees/service";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const result = await deleteLeaveRequest(session, params.id);
  return serviceResultToResponse(result);
}
