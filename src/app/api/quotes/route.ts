import { NextRequest } from "next/server";
import { requireSession, requireWritable, isSession, serviceResultToResponse, zodErrorResponse } from "@/lib/api/handlers";
import { listQuotes, createQuote } from "@/lib/modules/quotes/service";
import { quoteInputSchema } from "@/lib/validation/quote";
import { listQuotesQuerySchema } from "@/lib/validation/quote";

export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const parsed = listQuotesQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await listQuotes(session, parsed.data);
  return serviceResultToResponse(result);
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const body = await req.json().catch(() => null);
  const parsed = quoteInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await createQuote(session, parsed.data);
  return serviceResultToResponse(result, 201);
}
