import { requireSession, requireWritable, isSession, serviceResultToResponse } from "@/lib/api/handlers";
import { advanceOrderStatus } from "@/lib/modules/orders/service";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const result = await advanceOrderStatus(session, params.id);
  return serviceResultToResponse(result);
}
