import { requireSession, requireWritable, isSession, serviceResultToResponse, zodErrorResponse } from "@/lib/api/handlers";
import { cancelPayment } from "@/lib/modules/payments/service";
import { cancelPaymentSchema } from "@/lib/validation/payment";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const body = await req.json().catch(() => null);
  const parsed = cancelPaymentSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await cancelPayment(session, params.id, parsed.data.reason);
  return serviceResultToResponse(result);
}
