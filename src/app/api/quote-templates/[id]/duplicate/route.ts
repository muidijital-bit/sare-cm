import { NextRequest } from "next/server";
import { requireSession, requireWritable, isSession, serviceResultToResponse } from "@/lib/api/handlers";
import { duplicateTemplate } from "@/lib/modules/quote-templates/service";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;
  return serviceResultToResponse(await duplicateTemplate(session, params.id), 201);
}
