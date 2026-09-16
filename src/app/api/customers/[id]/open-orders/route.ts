import { requireSession, isSession, serviceResultToResponse } from "@/lib/api/handlers";
import { listOpenOrdersForCustomer } from "@/lib/modules/orders/service";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const result = await listOpenOrdersForCustomer(session, params.id);
  return serviceResultToResponse(result);
}
