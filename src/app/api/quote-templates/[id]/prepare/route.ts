import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession, requireWritable, isSession, serviceResultToResponse, zodErrorResponse } from "@/lib/api/handlers";
import { prepareQuoteFromTemplate } from "@/lib/modules/quote-templates/service";

const schema = z.object({
  customerId: z.string().uuid("Müşteri seçin"),
  sheetNames: z.array(z.string().max(31)).max(30).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  return serviceResultToResponse(await prepareQuoteFromTemplate(session, params.id, parsed.data), 201);
}
