import { NextRequest } from "next/server";
import { requireSession, requireWritable, isSession, serviceResultToResponse } from "@/lib/api/handlers";
import { cancelPurchaseOrder } from "@/lib/modules/purchase-orders/service";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const result = await cancelPurchaseOrder(session, params.id);
  return serviceResultToResponse(result);
}
