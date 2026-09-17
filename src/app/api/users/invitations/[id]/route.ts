import { requireSession, requireWritable, isSession, serviceResultToResponse } from "@/lib/api/handlers";
import { cancelInvitation } from "@/lib/modules/users/service";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const result = await cancelInvitation(session, params.id);
  return serviceResultToResponse(result);
}
