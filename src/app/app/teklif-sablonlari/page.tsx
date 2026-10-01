import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { getScope } from "@/lib/auth/access";
import { withTenant } from "@/lib/db/tenant-context";
import { AccessDenied } from "@/components/ui/access-denied";
import { Badge } from "@/components/ui/badge";
import { canManageTemplates, listWorkbooks } from "@/lib/modules/quote-templates/service";
import { workbookContentSchema } from "@/lib/modules/quote-templates/types";
import { formatCurrencyTRY, formatDateTR } from "@/lib/i18n/tr";
import { TemplateRowActions, DeleteButton } from "./_components/workbook-actions";

export default async function TeklifSablonlariPage({ searchParams }: { searchParams: { tab?: string; q?: string } }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");
  const viewScope = getScope(session, "quote", "view");
  if (!viewScope) return <AccessDenied session={session} module="quote" />;

  const tab = searchParams.tab === "teklifler" ? "QUOTE" : "TEMPLATE";
  const canManage = canManageTemplates(session);
  const canPrepare = !!getScope(session, "quote", "create");
  const canDelete = !!getScope(session, "quote", "delete");

  const [result, customers, templates] = await Promise.all([
    listWorkbooks(session, tab, searchParams.q),
    canPrepare && tab === "TEMPLATE"
      ? withTenant(session.companyId, (tx) =>
          tx.customer.findMany({
            where: { deletedAt: null, ...(getScope(session, "customer", "view") === "own" ? { ownerUserId: session.userId } : {}) },
            orderBy: { title: "asc" },
            select: { id: true, title: true },
          }),
        )
      : Promise.resolve([]),
    tab === "TEMPLATE"
      ? withTenant(session.companyId, (tx) => tx.quoteWorkbook.findMany({ where: { kind: "TEMPLATE", deletedAt: null }, select: { id: true, content: true } }))
      : Promise.resolve([]),
  ]);
  if (!result.ok) return <p className="text-sm text-red-600">{result.message}</p>;
  const sheetNamesById = new Map(templates.map((t) => [t.id, workbookContentSchema.parse(t.content).sheets.map((s) => s.name)]));
  const rows = result.data;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Teklif Şablonları</h1>
          <p className="mt-1 text-sm text-gray-500">Logolu, antetli, çok sayfalı teklif şablonları; şablondan müşteriye teklif hazırlayıp Excel olarak gönderin.</p>
        </div>
        {canManage && tab === "TEMPLATE" && (
          <Link href="/app/teklif-sablonlari/yeni" className="rounded-lg bg-brand-800 px-3 py-2 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-700">
            + Yeni şablon
          </Link>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            ["TEMPLATE", "Şablonlar", "/app/teklif-sablonlari"],
            ["QUOTE", "Hazırlanan teklifler", "/app/teklif-sablonlari?tab=teklifler"],
          ] as const
        ).map(([k, l, href]) => (
          <Link
            key={k}
            href={href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === k ? "bg-brand-800 text-white" : "border border-gray-200 bg-white text-gray-700 hover:border-violet-300"}`}
          >
            {l}
          </Link>
        ))}
        <form className="ml-auto" action="/app/teklif-sablonlari">
          {tab === "QUOTE" && <input type="hidden" name="tab" value="teklifler" />}
          <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Ad veya müşteri ara…" className="w-64 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
        </form>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-theme-xs">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-theme-xs font-medium text-gray-500">
            <tr>
              <th className="px-4 py-3">{tab === "TEMPLATE" ? "Şablon" : "Teklif"}</th>
              {tab === "QUOTE" && <th className="px-4 py-3">Müşteri</th>}
              <th className="px-4 py-3">Sayfa</th>
              <th className="px-4 py-3 text-right">İcmal toplamı</th>
              {tab === "QUOTE" && <th className="px-4 py-3">Durum</th>}
              <th className="px-4 py-3">Güncelleme</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  {tab === "TEMPLATE" ? (
                    <>
                      Henüz şablon yok.{" "}
                      {canManage && (
                        <Link href="/app/teklif-sablonlari/yeni" className="text-violet-700 hover:underline">
                          Yeni şablon oluşturun
                        </Link>
                      )}{" "}
                      — mevcut Excel teklif dosyanızı içe aktararak başlayabilirsiniz.
                    </>
                  ) : (
                    "Henüz şablondan hazırlanmış teklif yok. Şablonlar sekmesinde “Teklif hazırla”yı kullanın."
                  )}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3">
                  <Link href={`/app/teklif-sablonlari/${r.id}`} className="font-medium text-gray-900 hover:underline">
                    {r.name}
                  </Link>
                  {r.description && <p className="text-xs text-gray-400">{r.description}</p>}
                  {r.quoteNo && <p className="text-xs text-gray-400">{r.quoteNo}</p>}
                </td>
                {tab === "QUOTE" && <td className="px-4 py-3 text-gray-600">{r.customerTitle ?? "—"}</td>}
                <td className="px-4 py-3 text-gray-600">{r.sheetCount}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{r.total > 0 ? formatCurrencyTRY(r.total) : "—"}</td>
                {tab === "QUOTE" && (
                  <td className="px-4 py-3">
                    {r.convertedQuoteId ? (
                      <Link href={`/app/teklifler/${r.convertedQuoteId}`}>
                        <Badge color="green">Satış teklifi</Badge>
                      </Link>
                    ) : (
                      <Badge color="gray">Taslak</Badge>
                    )}
                  </td>
                )}
                <td className="px-4 py-3 text-gray-500">{formatDateTR(new Date(r.updatedAt))}</td>
                <td className="px-4 py-3">
                  {tab === "TEMPLATE" ? (
                    <TemplateRowActions id={r.id} sheetNames={sheetNamesById.get(r.id) ?? []} customers={customers} canPrepare={canPrepare} canManage={canManage} />
                  ) : (
                    <div className="flex justify-end gap-1.5">
                      <a href={`/api/quote-templates/${r.id}/export?mode=customer`} className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50">
                        Excel
                      </a>
                      {canDelete && !r.convertedQuoteId && <DeleteButton id={r.id} label="Hazırlanan teklif silinsin mi?" />}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
