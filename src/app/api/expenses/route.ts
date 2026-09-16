import { NextRequest } from "next/server";
import { requireSession, requireWritable, isSession, serviceResultToResponse, zodErrorResponse } from "@/lib/api/handlers";
import { listExpenses, createExpense } from "@/lib/modules/expenses/service";
import { expenseInputSchema, listExpensesQuerySchema } from "@/lib/validation/expense";

export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const parsed = listExpensesQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await listExpenses(session, parsed.data);
  return serviceResultToResponse(result);
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const body = await req.json().catch(() => null);
  const parsed = expenseInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await createExpense(session, parsed.data);
  return serviceResultToResponse(result, 201);
}
