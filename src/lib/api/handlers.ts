import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getTenantSession, assertWritable, type TenantSession } from "@/lib/auth/session";
import type { ServiceResult } from "@/lib/modules/result";

/**
 * Her tenant-kapsamlı Route Handler'ın başında çağrılır. Oturum yoksa 401 döner.
 * Bkz. .claude/agents/api-backend-dev.md — yetki kontrolü route'a saçılmaz, ama oturum
 * doğrulaması ortak bir noktadan yapılır.
 */
export async function requireSession(): Promise<TenantSession | NextResponse> {
  const session = await getTenantSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadı veya şirket seçilmemiş." }, { status: 401 });
  }
  return session;
}

/** Yazma (create/update/delete) uçlarında ek olarak çağrılır — askıdaki şirket engellenir (PF-04). */
export function requireWritable(session: TenantSession): NextResponse | null {
  const check = assertWritable(session);
  if (!check.ok) {
    return NextResponse.json({ error: check.message }, { status: 403 });
  }
  return null;
}

export function isSession(value: TenantSession | NextResponse): value is TenantSession {
  return !(value instanceof NextResponse);
}

export function serviceResultToResponse<T>(result: ServiceResult<T>, successStatus = 200): NextResponse {
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
  return NextResponse.json(result.data, { status: successStatus });
}

/** zod hatasını Türkçe, alan bazlı bir mesaja çevirir. */
export function zodErrorResponse(error: ZodError): NextResponse {
  const first = error.issues[0];
  return NextResponse.json(
    { error: first ? `${first.path.join(".")}: ${first.message}` : "Geçersiz veri.", issues: error.issues },
    { status: 400 },
  );
}
