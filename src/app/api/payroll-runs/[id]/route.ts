import { NextRequest } from "next/server";
import { requireSession, requireWritable, isSession, serviceResultToResponse } from "@/lib/api/handlers";
import { getPayrollRun, deletePayrollRun } from "@/lib/modules/payroll/service";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const result = await getPayrollRun(session, params.id);
  return serviceResultToResponse(result);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const result = await deletePayrollRun(session, params.id);
  return serviceResultToResponse(result);
}
