import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireWritable, isSession } from "@/lib/api/handlers";
import { bulkDeleteCustomers } from "@/lib/modules/customers/service";
import { bulkIdsSchema } from "@/lib/validation/bulk";

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const body = await req.json().catch(() => null);
  const parsed = bulkIdsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });

  const result = await bulkDeleteCustomers(session, parsed.data.ids);
  return NextResponse.json(result);
}
