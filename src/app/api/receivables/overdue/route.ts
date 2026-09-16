import { requireSession, isSession, serviceResultToResponse } from "@/lib/api/handlers";
import { listOverdueReceivables } from "@/lib/modules/payments/service";

/** TH-07: Vadesi geçmiş alacaklar listesi. */
export async function GET() {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const result = await listOverdueReceivables(session);
  return serviceResultToResponse(result);
}
