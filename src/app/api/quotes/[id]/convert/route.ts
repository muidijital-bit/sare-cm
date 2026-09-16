import { requireSession, requireWritable, isSession, serviceResultToResponse } from "@/lib/api/handlers";
import { createOrderFromQuote } from "@/lib/modules/orders/service";

/** TK-08: kabul edilen tekliften tek tıkla sipariş oluşturma. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const result = await createOrderFromQuote(session, params.id);
  return serviceResultToResponse(result, 201);
}
