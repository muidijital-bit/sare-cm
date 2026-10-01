import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireWritable, isSession, serviceResultToResponse, zodErrorResponse } from "@/lib/api/handlers";
import { listWorkbooks, createWorkbook } from "@/lib/modules/quote-templates/service";
import { workbookInputSchema } from "@/lib/modules/quote-templates/types";

const kindOf = (v: string | null) => (v === "QUOTE" ? "QUOTE" : "TEMPLATE");

export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const result = await listWorkbooks(session, kindOf(req.nextUrl.searchParams.get("kind")), req.nextUrl.searchParams.get("q") ?? undefined);
  return serviceResultToResponse(result);
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const body = await req.json().catch(() => null);
  const parsed = workbookInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const kind = kindOf(typeof body?.kind === "string" ? body.kind : null);
  const result = await createWorkbook(session, kind, parsed.data);
  return result.ok ? NextResponse.json(result.data, { status: 201 }) : serviceResultToResponse(result);
}
