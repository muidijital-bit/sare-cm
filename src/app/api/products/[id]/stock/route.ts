import { NextRequest } from "next/server";
import { requireSession, requireWritable, isSession, serviceResultToResponse, zodErrorResponse } from "@/lib/api/handlers";
import { getProductStock, adjustStock } from "@/lib/modules/purchase-orders/service";
import { stockAdjustmentInputSchema } from "@/lib/validation/purchase-order";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const result = await getProductStock(session, params.id);
  return serviceResultToResponse(result);
}

/** Manuel stok düzeltmesi — body: { quantity, note }; productId URL'den alınır. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const body = await req.json().catch(() => null);
  const parsed = stockAdjustmentInputSchema.safeParse({ ...body, productId: params.id });
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await adjustStock(session, parsed.data);
  return serviceResultToResponse(result);
}
