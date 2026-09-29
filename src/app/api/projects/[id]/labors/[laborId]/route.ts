import { NextRequest } from "next/server";
import { requireSession, requireWritable, isSession, serviceResultToResponse } from "@/lib/api/handlers";
import { deleteProjectLabor } from "@/lib/modules/projects/service";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; laborId: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const result = await deleteProjectLabor(session, params.id, params.laborId);
  return serviceResultToResponse(result);
}
