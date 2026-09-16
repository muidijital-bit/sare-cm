import { NextRequest } from "next/server";
import { requireSession, requireWritable, isSession, serviceResultToResponse, zodErrorResponse } from "@/lib/api/handlers";
import { getCustomer, updateCustomer, deleteCustomer } from "@/lib/modules/customers/service";
import { customerInputSchema } from "@/lib/validation/customer";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const result = await getCustomer(session, params.id);
  return serviceResultToResponse(result);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const body = await req.json().catch(() => null);
  const parsed = customerInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await updateCustomer(session, params.id, parsed.data);
  return serviceResultToResponse(result);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const result = await deleteCustomer(session, params.id);
  return serviceResultToResponse(result);
}
