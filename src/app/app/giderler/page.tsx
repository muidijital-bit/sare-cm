import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/tenant-context";
import { listExpenses, getCategoryReport } from "@/lib/modules/expenses/service";
import { listExpensesQuerySchema } from "@/lib/validation/expense";
import { getScope } from "@/lib/auth/access";
import { AccessDenied } from "@/components/ui/access-denied";
import { tr, formatCurrencyTRY, formatDateTR } from "@/lib/i18n/tr";
import { DeleteExpenseButton } from "./_components/delete-expense-button";
import { GridFilters } from "@/components/ui/grid-filters";
import { Badge, tagColor } from "@/components/ui/badge";
import { exportKeyFor } from "@/lib/export/registry";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";

export default async function GiderlerPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const scope = getScope(session, "expense", "view");
  if (!scope) return <AccessDenied session={session} module="expense" />;

  const parsed = listExpensesQuerySchema.safeParse(searchParams);
  const query = parsed.success ? parsed.data : { page: 1, pageSize: 20 };
  const [result, reportResult, categories] = await Promise.all([
    listExpenses(session, query),
    getCategoryReport(session),
    withTenant(session.companyId, (tx) =>
      tx.expenseCategory.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ),
  ]);
  if (!result.ok) return <p className="text-sm text-red-600">{result.message}</p>;

  const { items, total, page, pageSize } = result.data;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canCreate = !!getScope(session, "expense", "create");
  const canDelete = !!getScope(session, "expense", "delete");
  const report = reportResult.ok ? reportResult.data : [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">{tr.expense.title}</h1>
        <div className="flex items-center gap-3">
          {canCreate && (
            <Link href="/app/giderler/yeni" className="rounded-lg bg-brand-800 shadow-theme-xs px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
              + {tr.expense.new}
            </Link>
          )}
        </div>
      </div>

      {report.length > 0 && (
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white shadow-theme-xs p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">{tr.expense.categoryReport}</h2>
          <div className="flex flex-wrap gap-4 text-sm">
            {report.map((r) => (
              <div key={r.categoryId} className="flex items-center gap-2">
                <Badge color={tagColor(r.categoryName)} dot={false}>
                  {r.categoryName}
                </Badge>
                <span className="font-medium text-gray-900">{formatCurrencyTRY(r.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <GridFilters
        exportKey={exportKeyFor(session, "giderler")}
        search={{ rowSelector: "searchable-row-expenses", placeholder: tr.expense.searchPlaceholder }}
        rowCount={items.length}
        total={total}
        selects={[{ param: "categoryId", placeholder: "Tüm kategoriler", options: categories.map((c) => ({ value: c.id, label: c.name })) }]}
        dateRange={{ label: "Gider tarihi" }}
      />

      {canDelete && (
        <BulkActionBar
          rowSelector="row-select-expenses"
          selectAllSelector="row-select-all-expenses"
          entityLabel="gider"
          actions={[
            {
              key: "delete",
              label: tr.expense.bulkDelete,
              endpoint: "/api/expenses/bulk-delete",
              variant: "danger",
              confirmMessage: tr.expense.bulkDeleteConfirm,
            },
          ]}
        />
      )}

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-theme-xs">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-theme-xs font-medium text-gray-500">
            <tr>
              {canDelete && (
                <th className="w-8 px-4 py-3">
                  <input type="checkbox" className="row-select-all-expenses" aria-label="Tümünü seç" />
                </th>
              )}
              <th className="px-4 py-3">{tr.expense.fields.spentAt}</th>
              <th className="px-4 py-3">{tr.expense.fields.category}</th>
              <th className="px-4 py-3">{tr.expense.fields.vendor}</th>
              <th className="px-4 py-3 text-right">{tr.expense.fields.amount}</th>
              {canDelete && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  {tr.expense.empty}
                </td>
              </tr>
            )}
            {items.map((e) => (
              <tr
                key={e.id}
                className="searchable-row-expenses"
                data-search={[e.category.name, e.vendor].filter(Boolean).join(" ")}
              >
                {canDelete && (
                  <td className="px-4 py-3">
                    <input type="checkbox" className="row-select-expenses" data-id={e.id} />
                  </td>
                )}
                <td className="px-4 py-3">
                  <Link href={`/app/giderler/${e.id}/duzenle`} className="font-medium text-gray-900 hover:underline">
                    {formatDateTR(new Date(e.spentAt))}
                  </Link>
                  {e.parentExpenseId && <span className="ml-1 text-xs text-gray-400">(otomatik)</span>}
                </td>
                <td className="px-4 py-3">
                  <Badge color={tagColor(e.category.name)} dot={false}>
                    {e.category.name}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-gray-600">{e.vendor ?? "—"}</td>
                <td className="px-4 py-3 text-right text-gray-900">{formatCurrencyTRY(Number(e.amount))}</td>
                {canDelete && (
                  <td className="px-4 py-3 text-right">
                    <DeleteExpenseButton expenseId={e.id} />
                  </td>
                )}
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
              href={{ pathname: "/app/giderler", query: { ...searchParams, page: p } }}
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
