import { requireSession, requireWritable, isSession, serviceResultToResponse } from "@/lib/api/handlers";
import { createRevision } from "@/lib/modules/quotes/service";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const result = await createRevision(session, params.id);
  return serviceResultToResponse(result, 201);
}
