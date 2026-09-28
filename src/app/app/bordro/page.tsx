import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { listPayrollRuns } from "@/lib/modules/payroll/service";
import { listPayrollRunsQuerySchema } from "@/lib/validation/payroll";
import { getScope } from "@/lib/auth/access";
import { AccessDenied } from "@/components/ui/access-denied";
import { tr, formatCurrencyTRY } from "@/lib/i18n/tr";
import { Badge, PAYROLL_RUN_STATUS_COLORS } from "@/components/ui/badge";

export default async function BordroPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const scope = getScope(session, "payroll", "view");
  if (!scope) return <AccessDenied session={session} module="payroll" />;

  const parsed = listPayrollRunsQuerySchema.safeParse(searchParams);
  const query = parsed.success ? parsed.data : { page: 1, pageSize: 20 };
  const result = await listPayrollRuns(session, query);
  if (!result.ok) return <p className="text-sm text-red-600">{result.message}</p>;

  const { items } = result.data;
  const canCreate = !!getScope(session, "payroll", "create");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">{tr.payroll.title}</h1>
        {canCreate && (
          <Link href="/app/bordro/yeni" className="rounded-md bg-brand-800 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            + {tr.payroll.new}
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">{tr.payroll.fields.period}</th>
              <th className="px-4 py-3">{tr.payroll.fields.status}</th>
              <th className="px-4 py-3 text-right">{tr.payroll.fields.totalGross}</th>
              <th className="px-4 py-3 text-right">{tr.payroll.fields.totalEmployerCost}</th>
              <th className="px-4 py-3 text-right">{tr.payroll.fields.totalNet}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  {tr.payroll.empty}
                </td>
              </tr>
            )}
            {items.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/app/bordro/${r.id}`} className="font-medium text-gray-900 hover:underline">
                    {r.period}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Badge color={PAYROLL_RUN_STATUS_COLORS[r.status]}>{tr.payroll.status[r.status as keyof typeof tr.payroll.status]}</Badge>
                </td>
                <td className="px-4 py-3 text-right text-gray-600">{formatCurrencyTRY(Number(r.totalGross))}</td>
                <td className="px-4 py-3 text-right text-gray-600">{formatCurrencyTRY(Number(r.totalEmployerCost))}</td>
                <td className="px-4 py-3 text-right text-gray-900">{formatCurrencyTRY(Number(r.totalNet))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
