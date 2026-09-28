import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { listTaxObligations } from "@/lib/modules/tax-obligations/service";
import { listTaxObligationsQuerySchema } from "@/lib/validation/tax-obligation";
import { withTenant } from "@/lib/db/tenant-context";
import { getScope } from "@/lib/auth/access";
import { AccessDenied } from "@/components/ui/access-denied";
import { tr, formatCurrencyTRY, formatDateTR } from "@/lib/i18n/tr";
import { Badge, TAX_OBLIGATION_STATUS_COLORS } from "@/components/ui/badge";
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

  const { items } = result.data;
  const canCreate = !!getScope(session, "taxObligation", "create");
  const canEdit = !!getScope(session, "taxObligation", "edit");
  const canDelete = !!getScope(session, "taxObligation", "delete");

  const accounts = canEdit ? await withTenant(session.companyId, (tx) => tx.account.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })) : [];
  const accountOptions = accounts.map((a) => ({ id: a.id, name: a.name }));
  const now = new Date();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">{tr.taxObligation.title}</h1>
        {canCreate && (
          <Link href="/app/vergi-sgk/yeni" className="rounded-md bg-brand-800 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            + {tr.taxObligation.new}
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
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
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{tr.taxObligation.type[o.type as keyof typeof tr.taxObligation.type]}</td>
                  <td className="px-4 py-3 text-gray-600">{o.period}</td>
                  <td className={`px-4 py-3 ${overdue ? "font-medium text-red-600" : "text-gray-600"}`}>
                    {formatDateTR(new Date(o.dueDate))}
                    {overdue && <span className="ml-1 text-xs">({tr.taxObligation.overdue})</span>}
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
    </div>
  );
}
