import { NextRequest, NextResponse } from "next/server";
import { requireSession, isSession } from "@/lib/api/handlers";
import { withTenant } from "@/lib/db/tenant-context";
import { writeAuditLog } from "@/lib/audit/log";
import { EXPORTS, canExport } from "@/lib/export/registry";
import { buildXlsx, xlsxResponseHeaders } from "@/lib/export/xlsx";

/**
 * Tüm gridlerin ortak Excel (.xlsx) dışa aktarma ucu: /api/export/<grid>?<sayfadaki filtreler>.
 * Filtreler sayfanın kullandığı AYNI şemayla yorumlanır, veriler AYNI liste servisinden gelir
 * (rol kapsamı + RLS aynen geçerli). Her aktarma İşlem Geçmişi'ne EXPORT olarak yazılır.
 */
export async function GET(req: NextRequest, { params }: { params: { module: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const def = EXPORTS[params.module];
  if (!def) return NextResponse.json({ error: "Bilinmeyen liste." }, { status: 404 });
  if (!canExport(session, params.module)) return NextResponse.json({ error: "Bu listeyi dışa aktarma yetkiniz yok." }, { status: 403 });

  const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
  delete raw.page;
  delete raw.pageSize;
  const parsed = def.schema ? def.schema.safeParse(raw) : { success: true as const, data: {} };
  const filters = parsed.success ? (parsed.data as Record<string, unknown>) : {};

  const result = await def.fetch(session, filters);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });

  const activeFilters = Object.keys(raw).filter((k) => raw[k]).length;
  const buffer = await buildXlsx({
    sheetName: def.title,
    title: `${def.title} — ${session.companyName}`,
    subtitle: activeFilters > 0 ? `${activeFilters} filtre uygulandı` : "Tüm kayıtlar",
    rows: result.data.items,
    columns: def.columns,
  });

  await withTenant(session.companyId, (tx) =>
    writeAuditLog(tx, {
      companyId: session.companyId,
      userId: session.userId,
      action: "EXPORT",
      entityType: params.module,
      changes: { kayitSayisi: { eski: null, yeni: result.data.items.length }, filtreler: { eski: null, yeni: raw } },
    }),
  ).catch(() => undefined);

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buffer), { headers: xlsxResponseHeaders(`${def.filename}-${stamp}.xlsx`) });
}
