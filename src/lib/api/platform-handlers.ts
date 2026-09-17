import { NextResponse } from "next/server";
import { getSuperAdminSession, type SuperAdminSession } from "@/lib/auth/session";

/** PF-08: platform uçları yalnızca süper admin için — ayrı kontrol, tenant session'dan bağımsız. */
export async function requireSuperAdmin(): Promise<SuperAdminSession | NextResponse> {
  const session = await getSuperAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }
  return session;
}

export function isSuperAdminSession(value: SuperAdminSession | NextResponse): value is SuperAdminSession {
  return !(value instanceof NextResponse);
}
