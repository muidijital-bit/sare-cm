import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/tenant-context";
import { listQuotes } from "@/lib/modules/quotes/service";
import { listQuotesQuerySchema } from "@/lib/validation/quote";
import { getRequiredScope } from "@/lib/auth/rbac";
import { tr, formatCurrencyTRY, formatDateTR } from "@/lib/i18n/tr";
import { Badge, QUOTE_STATUS_COLORS } from "@/components/ui/badge";
import { QuoteFilterBar } from "./_components/quote-filter-bar";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";

export default async function TekliflerPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const scope = getRequiredScope(session.role, "quote", "view");
  if (!scope) return <p className="text-sm text-gray-500">Bu modülü görüntüleme yetkiniz yok.</p>;

  const parsed = listQuotesQuerySchema.safeParse(searchParams);
  const query = parsed.success ? parsed.data : { page: 1, pageSize: 20 };
  const [result, users] = await Promise.all([
    listQuotes(session, query),
    scope === "all"
      ? withTenant(session.companyId, (tx) =>
          tx.membership.findMany({
            where: { isActive: true },
            include: { user: { select: { id: true, name: true } } },
            orderBy: { user: { name: "asc" } },
          }),
        )
      : Promise.resolve([]),
  ]);
  if (!result.ok) return <p className="text-sm text-red-600">{result.message}</p>;

  const { items, total, page, pageSize } = result.data;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canCreate = !!getRequiredScope(session.role, "quote", "create");
  const canDelete = !!getRequiredScope(session.role, "quote", "delete");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">{tr.quote.title}</h1>
        {canCreate && (
          <Link href="/app/teklifler/yeni" className="rounded-md bg-brand-800 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            + {tr.quote.new}
          </Link>
        )}
      </div>

      <QuoteFilterBar showOwnerFilter={scope === "all"} users={users.map((m) => ({ id: m.user.id, name: m.user.name }))} />

      {canDelete && (
        <BulkActionBar
          rowSelector="row-select-quotes"
          selectAllSelector="row-select-all-quotes"
          entityLabel="teklif"
          actions={[
            {
              key: "delete",
              label: tr.quote.bulkDelete,
              endpoint: "/api/quotes/bulk-delete",
              variant: "danger",
              confirmMessage: tr.quote.bulkDeleteConfirm,
            },
          ]}
        />
      )}
      {canDelete && <p className="mb-3 text-xs text-gray-400">{tr.quote.bulkDeleteHint}</p>}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              {canDelete && (
                <th className="w-8 px-4 py-3">
                  <input type="checkbox" className="row-select-all-quotes" aria-label="Tümünü seç" />
                </th>
              )}
              <th className="px-4 py-3">No</th>
              <th className="px-4 py-3">{tr.document.customer}</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">{tr.document.validUntil}</th>
              <th className="px-4 py-3 text-right">{tr.document.grandTotal}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  {tr.quote.empty}
                </td>
              </tr>
            )}
            {items.map((q) => (
              <tr key={q.id} className="hover:bg-gray-50">
                {canDelete && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="row-select-quotes"
                      data-id={q.id}
                      disabled={q.status !== "DRAFT"}
                      title={q.status !== "DRAFT" ? tr.quote.bulkDeleteHint : undefined}
                    />
                  </td>
                )}
                <td className="px-4 py-3">
                  <Link href={`/app/teklifler/${q.id}`} className="font-medium text-gray-900 hover:underline">
                    {q.number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{q.customer.title}</td>
                <td className="px-4 py-3">
                  <Badge color={QUOTE_STATUS_COLORS[q.status]}>{tr.quote.status[q.status]}</Badge>
                </td>
                <td className="px-4 py-3 text-gray-600">{formatDateTR(new Date(q.validUntil))}</td>
                <td className="px-4 py-3 text-right text-gray-900">{formatCurrencyTRY(Number(q.grandTotal))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={{ pathname: "/app/teklifler", query: { ...searchParams, page: p } }}
              className={`rounded-md px-3 py-1 ${p === page ? "bg-brand-800 text-white" : "text-gray-600 hover:bg-gray-100"}`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
