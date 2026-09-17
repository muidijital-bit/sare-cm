import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireWritable, isSession } from "@/lib/api/handlers";
import { bulkCancelPayments } from "@/lib/modules/payments/service";
import { bulkIdsWithReasonSchema } from "@/lib/validation/bulk";

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const body = await req.json().catch(() => null);
  const parsed = bulkIdsWithReasonSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz istek (gerekçe zorunlu)." }, { status: 400 });

  const result = await bulkCancelPayments(session, parsed.data.ids, parsed.data.reason);
  return NextResponse.json(result);
}
