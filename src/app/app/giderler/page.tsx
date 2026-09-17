import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/tenant-context";
import { listExpenses, getCategoryReport } from "@/lib/modules/expenses/service";
import { listExpensesQuerySchema } from "@/lib/validation/expense";
import { getRequiredScope } from "@/lib/auth/rbac";
import { tr, formatCurrencyTRY, formatDateTR } from "@/lib/i18n/tr";
import { DeleteExpenseButton } from "./_components/delete-expense-button";
import { ExpenseFilterBar } from "./_components/expense-filter-bar";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";

export default async function GiderlerPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const scope = getRequiredScope(session.role, "expense", "view");
  if (!scope) return <p className="text-sm text-gray-500">Bu modülü görüntüleme yetkiniz yok.</p>;

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
  const canCreate = !!getRequiredScope(session.role, "expense", "create");
  const canDelete = !!getRequiredScope(session.role, "expense", "delete");
  const canExport = !!getRequiredScope(session.role, "expense", "export");
  const report = reportResult.ok ? reportResult.data : [];
  const exportQuery = new URLSearchParams(searchParams as Record<string, string>).toString();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">{tr.expense.title}</h1>
        <div className="flex items-center gap-3">
          {canExport && (
            <a
              href={`/api/expenses/export${exportQuery ? `?${exportQuery}` : ""}`}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {tr.expense.export}
            </a>
          )}
          {canCreate && (
            <Link href="/app/giderler/yeni" className="rounded-md bg-brand-800 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
              + {tr.expense.new}
            </Link>
          )}
        </div>
      </div>

      {report.length > 0 && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">{tr.expense.categoryReport}</h2>
          <div className="flex flex-wrap gap-4 text-sm">
            {report.map((r) => (
              <div key={r.categoryId} className="flex items-center gap-2">
                <span className="text-gray-500">{r.categoryName}:</span>
                <span className="font-medium text-gray-900">{formatCurrencyTRY(r.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <ExpenseFilterBar categories={categories} />

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

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
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
              <tr key={e.id} className="hover:bg-gray-50">
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
                <td className="px-4 py-3 text-gray-600">{e.category.name}</td>
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
