import { NextRequest } from "next/server";
import { requireSession, requireWritable, isSession, serviceResultToResponse, zodErrorResponse } from "@/lib/api/handlers";
import { updateMembership } from "@/lib/modules/users/service";
import { updateMembershipInputSchema } from "@/lib/validation/users";

export async function PATCH(req: NextRequest, { params }: { params: { membershipId: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const body = await req.json().catch(() => null);
  const parsed = updateMembershipInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await updateMembership(session, params.membershipId, parsed.data);
  return serviceResultToResponse(result);
}
