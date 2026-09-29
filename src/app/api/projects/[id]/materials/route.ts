import { NextRequest } from "next/server";
import { requireSession, requireWritable, isSession, serviceResultToResponse, zodErrorResponse } from "@/lib/api/handlers";
import { addProjectMaterial } from "@/lib/modules/projects/service";
import { projectMaterialInputSchema } from "@/lib/validation/project";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const body = await req.json().catch(() => null);
  const parsed = projectMaterialInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await addProjectMaterial(session, params.id, parsed.data);
  return serviceResultToResponse(result, 201);
}
