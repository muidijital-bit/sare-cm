import { NextRequest } from "next/server";
import { requireSession, requireWritable, isSession, serviceResultToResponse, zodErrorResponse } from "@/lib/api/handlers";
import { listPayments, createPayment } from "@/lib/modules/payments/service";
import { paymentInputSchema, listPaymentsQuerySchema } from "@/lib/validation/payment";

export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const parsed = listPaymentsQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await listPayments(session, parsed.data);
  return serviceResultToResponse(result);
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const body = await req.json().catch(() => null);
  const parsed = paymentInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await createPayment(session, parsed.data);
  return serviceResultToResponse(result, 201);
}
