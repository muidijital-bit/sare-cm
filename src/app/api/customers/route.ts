import { NextRequest } from "next/server";
import { requireSession, requireWritable, isSession, serviceResultToResponse, zodErrorResponse } from "@/lib/api/handlers";
import { listCustomers, createCustomer } from "@/lib/modules/customers/service";
import { customerInputSchema, listCustomersQuerySchema } from "@/lib/validation/customer";

export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const parsed = listCustomersQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await listCustomers(session, parsed.data);
  return serviceResultToResponse(result);
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const body = await req.json().catch(() => null);
  const parsed = customerInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await createCustomer(session, parsed.data);
  return serviceResultToResponse(result, 201);
}
