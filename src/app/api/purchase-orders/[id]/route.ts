import { NextRequest } from "next/server";
import { requireSession, isSession, serviceResultToResponse } from "@/lib/api/handlers";
import { getPurchaseOrder } from "@/lib/modules/purchase-orders/service";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const result = await getPurchaseOrder(session, params.id);
  return serviceResultToResponse(result);
}
