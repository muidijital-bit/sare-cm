import { NextRequest } from "next/server";
import { requireSession, requireWritable, isSession, serviceResultToResponse, zodErrorResponse } from "@/lib/api/handlers";
import { getWorkbook, updateWorkbook, deleteWorkbook } from "@/lib/modules/quote-templates/service";
import { workbookInputSchema } from "@/lib/modules/quote-templates/types";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  return serviceResultToResponse(await getWorkbook(session, params.id));
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;
  const parsed = workbookInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  return serviceResultToResponse(await updateWorkbook(session, params.id, parsed.data));
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;
  return serviceResultToResponse(await deleteWorkbook(session, params.id));
}
