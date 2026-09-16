import { NextRequest } from "next/server";
import { requireSession, requireWritable, isSession, serviceResultToResponse, zodErrorResponse } from "@/lib/api/handlers";
import { getQuote, updateQuote } from "@/lib/modules/quotes/service";
import { quoteInputSchema } from "@/lib/validation/quote";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const result = await getQuote(session, params.id);
  return serviceResultToResponse(result);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const body = await req.json().catch(() => null);
  const parsed = quoteInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await updateQuote(session, params.id, parsed.data);
  return serviceResultToResponse(result);
}
