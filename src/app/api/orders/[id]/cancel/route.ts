import { requireSession, requireWritable, isSession, serviceResultToResponse, zodErrorResponse } from "@/lib/api/handlers";
import { cancelOrder } from "@/lib/modules/orders/service";
import { cancelOrderSchema } from "@/lib/validation/order";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const body = await req.json().catch(() => null);
  const parsed = cancelOrderSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await cancelOrder(session, params.id, parsed.data.reason);
  return serviceResultToResponse(result);
}
