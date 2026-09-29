import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { listTaxObligations } from "@/lib/modules/tax-obligations/service";
import { listTaxObligationsQuerySchema } from "@/lib/validation/tax-obligation";
import { withTenant } from "@/lib/db/tenant-context";
import { getScope } from "@/lib/auth/access";
import { AccessDenied } from "@/components/ui/access-denied";
import { tr, formatCurrencyTRY, formatDateTR } from "@/lib/i18n/tr";
import { Badge, TAX_OBLIGATION_STATUS_COLORS, TAX_TYPE_COLORS } from "@/components/ui/badge";
import { GridFilters } from "@/components/ui/grid-filters";
import { Pagination } from "@/components/ui/pagination";
import { exportKeyFor } from "@/lib/export/registry";
import { TaxObligationActions } from "./_components/tax-obligation-actions";

export default async function VergiSgkPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const scope = getScope(session, "taxObligation", "view");
  if (!scope) return <AccessDenied session={session} module="taxObligation" />;

  const parsed = listTaxObligationsQuerySchema.safeParse(searchParams);
  const query = parsed.success ? parsed.data : { page: 1, pageSize: 20 };
  const result = await listTaxObligations(session, query);
  if (!result.ok) return <p className="text-sm text-red-600">{result.message}</p>;

  const { items, total, page, pageSize } = result.data;
  const canCreate = !!getScope(session, "taxObligation", "create");
  const canEdit = !!getScope(session, "taxObligation", "edit");
  const canDelete = !!getScope(session, "taxObligation", "delete");

  const accounts = canEdit ? await withTenant(session.companyId, (tx) => tx.account.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })) : [];
  const accountOptions = accounts.map((a) => ({ id: a.id, name: a.name }));
  const now = new Date();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">{tr.taxObligation.title}</h1>
        {canCreate && (
          <Link href="/app/vergi-sgk/yeni" className="rounded-lg bg-brand-800 shadow-theme-xs px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            + {tr.taxObligation.new}
          </Link>
        )}
      </div>

      <GridFilters
        exportKey={exportKeyFor(session, "vergi-sgk")}
        rowCount={items.length}
        total={total}
        selects={[
          { param: "type", placeholder: "Tüm türler", options: Object.entries(tr.taxObligation.type).map(([value, label]) => ({ value, label })) },
          { param: "status", placeholder: "Tüm durumlar", options: Object.entries(tr.taxObligation.status).map(([value, label]) => ({ value, label })) },
        ]}
        dateRange={{ label: "Son ödeme" }}
      />

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-theme-xs">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-theme-xs font-medium text-gray-500">
            <tr>
              <th className="px-4 py-3">{tr.taxObligation.fields.type}</th>
              <th className="px-4 py-3">{tr.taxObligation.fields.period}</th>
              <th className="px-4 py-3">{tr.taxObligation.fields.dueDate}</th>
              <th className="px-4 py-3 text-right">{tr.taxObligation.fields.amount}</th>
              <th className="px-4 py-3">{tr.taxObligation.fields.status}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  {tr.taxObligation.empty}
                </td>
              </tr>
            )}
            {items.map((o) => {
              const overdue = o.status === "PENDING" && new Date(o.dueDate) < now;
              return (
                <tr key={o.id} >
                  <td className="px-4 py-3">
                    <Badge color={TAX_TYPE_COLORS[o.type]} dot={false}>
                      {tr.taxObligation.type[o.type as keyof typeof tr.taxObligation.type]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{o.period}</td>
                  <td className={`px-4 py-3 ${overdue ? "font-medium text-red-600" : "text-gray-600"}`}>
                    {formatDateTR(new Date(o.dueDate))}
                    {overdue && (
                      <span className="ml-2">
                        <Badge color="red">{tr.taxObligation.overdue}</Badge>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatCurrencyTRY(Number(o.amount))}</td>
                  <td className="px-4 py-3">
                    <Badge color={TAX_OBLIGATION_STATUS_COLORS[o.status]}>{tr.taxObligation.status[o.status as keyof typeof tr.taxObligation.status]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {o.status === "PENDING" && (
                      <TaxObligationActions obligationId={o.id} amount={o.amount.toString()} accounts={accountOptions} canEdit={canEdit} canDelete={canDelete} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination pathname="/app/vergi-sgk" searchParams={searchParams} page={page} total={total} pageSize={pageSize} />
    </div>
  );
}
