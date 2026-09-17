import { NextRequest } from "next/server";
import { requireSession, requireWritable, isSession, serviceResultToResponse, zodErrorResponse } from "@/lib/api/handlers";
import { updateCustomerSource, deleteCustomerSource } from "@/lib/modules/company-settings/service";
import { namedRefInputSchema } from "@/lib/validation/company-settings";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const body = await req.json().catch(() => null);
  const parsed = namedRefInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await updateCustomerSource(session, params.id, parsed.data.name);
  return serviceResultToResponse(result);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const result = await deleteCustomerSource(session, params.id);
  return serviceResultToResponse(result);
}
