import { NextRequest, NextResponse } from "next/server";
import { requireSession, isSession } from "@/lib/api/handlers";
import { getScope } from "@/lib/auth/access";
import { withTenant } from "@/lib/db/tenant-context";
import { writeAuditLog } from "@/lib/audit/log";
import { getWorkbook } from "@/lib/modules/quote-templates/service";
import { buildWorkbookXlsx } from "@/lib/modules/quote-templates/export";
import { xlsxResponseHeaders } from "@/lib/export/xlsx";

/** ?mode=customer (varsayılan, maliyetsiz) | internal (maliyet/kâr dökümü — teklif düzenleme yetkisi gerekir). */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const mode = req.nextUrl.searchParams.get("mode") === "internal" ? "internal" : "customer";
  if (mode === "internal" && !getScope(session, "quote", "edit")) {
    return NextResponse.json({ error: "İç sürümü (maliyet/kâr) indirme yetkiniz yok." }, { status: 403 });
  }
  const wb = await getWorkbook(session, params.id);
  if (!wb.ok) return NextResponse.json({ error: wb.message }, { status: wb.status });

  const buffer = await buildWorkbookXlsx(wb.data.content, mode);
  await withTenant(session.companyId, (tx) =>
    writeAuditLog(tx, { companyId: session.companyId, userId: session.userId, action: "EXPORT", entityType: "quote_workbook", entityId: params.id, changes: { mod: { eski: null, yeni: mode } } }),
  ).catch(() => undefined);

  const base = (wb.data.content.customer.quoteNo || wb.data.name).replace(/[\\/:*?"<>|]/g, "").trim().slice(0, 80) || "teklif";
  return new NextResponse(new Uint8Array(buffer), { headers: xlsxResponseHeaders(`${base}${mode === "internal" ? " (iç)" : ""}.xlsx`) });
}
