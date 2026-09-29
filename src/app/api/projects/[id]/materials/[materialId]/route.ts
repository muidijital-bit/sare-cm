import { NextRequest } from "next/server";
import { requireSession, requireWritable, isSession, serviceResultToResponse } from "@/lib/api/handlers";
import { deleteProjectMaterial } from "@/lib/modules/projects/service";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; materialId: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const result = await deleteProjectMaterial(session, params.id, params.materialId);
  return serviceResultToResponse(result);
}
