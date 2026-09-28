import { NextRequest } from "next/server";
import { requireSession, requireWritable, isSession, serviceResultToResponse, zodErrorResponse } from "@/lib/api/handlers";
import { updatePayrollRunItem } from "@/lib/modules/payroll/service";
import { payrollRunItemInputSchema } from "@/lib/validation/payroll";

export async function PATCH(req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const body = await req.json().catch(() => null);
  const parsed = payrollRunItemInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await updatePayrollRunItem(session, params.id, params.itemId, parsed.data);
  return serviceResultToResponse(result);
}
