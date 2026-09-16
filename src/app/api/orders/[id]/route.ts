import { NextRequest } from "next/server";
import { requireSession, requireWritable, isSession, serviceResultToResponse, zodErrorResponse } from "@/lib/api/handlers";
import { getOrder, updateOrder } from "@/lib/modules/orders/service";
import { orderInputSchema } from "@/lib/validation/order";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const result = await getOrder(session, params.id);
  return serviceResultToResponse(result);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const body = await req.json().catch(() => null);
  const parsed = orderInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await updateOrder(session, params.id, parsed.data);
  return serviceResultToResponse(result);
}
