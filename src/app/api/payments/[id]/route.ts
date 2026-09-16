import { requireSession, isSession, serviceResultToResponse } from "@/lib/api/handlers";
import { getPayment } from "@/lib/modules/payments/service";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const result = await getPayment(session, params.id);
  return serviceResultToResponse(result);
}
