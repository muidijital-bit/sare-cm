import { NextRequest } from "next/server";
import { requireSession, requireWritable, isSession, serviceResultToResponse, zodErrorResponse } from "@/lib/api/handlers";
import { payTaxObligation } from "@/lib/modules/tax-obligations/service";
import { payTaxObligationInputSchema } from "@/lib/validation/tax-obligation";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const body = await req.json().catch(() => null);
  const parsed = payTaxObligationInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await payTaxObligation(session, params.id, parsed.data);
  return serviceResultToResponse(result);
}
