import { NextRequest } from "next/server";
import { requireSession, requireWritable, isSession, serviceResultToResponse, zodErrorResponse } from "@/lib/api/handlers";
import { completePayrollRun } from "@/lib/modules/payroll/service";
import { completePayrollRunInputSchema } from "@/lib/validation/payroll";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const body = await req.json().catch(() => null);
  const parsed = completePayrollRunInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await completePayrollRun(session, params.id, parsed.data.accountId);
  return serviceResultToResponse(result);
}
