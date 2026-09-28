import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { getPayrollRun } from "@/lib/modules/payroll/service";
import { withTenant } from "@/lib/db/tenant-context";
import { getScope } from "@/lib/auth/access";
import { AccessDenied } from "@/components/ui/access-denied";
import { tr, formatCurrencyTRY, formatDateTR } from "@/lib/i18n/tr";
import { Badge, PAYROLL_RUN_STATUS_COLORS } from "@/components/ui/badge";
import { PayrollItemsTable } from "./_components/payroll-items-table";
import { PayrollRunActions } from "./_components/payroll-run-actions";

export default async function BordroDetayPage({ params }: { params: { id: string } }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const scope = getScope(session, "payroll", "view");
  if (!scope) return <AccessDenied session={session} module="payroll" />;

  const result = await getPayrollRun(session, params.id);
  if (!result.ok) {
    if (result.status === 404) notFound();
    return <p className="text-sm text-red-600">{result.message}</p>;
  }
  const run = result.data;
  const canEdit = !!getScope(session, "payroll", "edit") && run.status === "DRAFT";

  const accounts =
    run.status === "DRAFT"
      ? await withTenant(session.companyId, (tx) => tx.account.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }))
      : [];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/app/bordro" className="text-xs text-brand-700 hover:underline">
            ← {tr.payroll.title}
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-gray-900">{run.period}</h1>
        </div>
        <PayrollRunActions runId={run.id} accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} canEdit={canEdit} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg border border-gray-200 bg-white p-4 text-sm sm:grid-cols-4">
        <div>
          <p className="text-gray-500">{tr.payroll.fields.status}</p>
          <Badge color={PAYROLL_RUN_STATUS_COLORS[run.status]}>{tr.payroll.status[run.status as keyof typeof tr.payroll.status]}</Badge>
        </div>
        <div>
          <p className="text-gray-500">{tr.payroll.fields.totalGross}</p>
          <p className="font-medium text-gray-900">{formatCurrencyTRY(Number(run.totalGross))}</p>
        </div>
        <div>
          <p className="text-gray-500">{tr.payroll.fields.totalEmployerCost}</p>
          <p className="font-medium text-gray-900">{formatCurrencyTRY(Number(run.totalEmployerCost))}</p>
        </div>
        <div>
          <p className="text-gray-500">{tr.payroll.fields.totalNet}</p>
          <p className="font-medium text-gray-900">{formatCurrencyTRY(Number(run.totalNet))}</p>
        </div>
        {run.status === "COMPLETED" && (
          <>
            <div>
              <p className="text-gray-500">{tr.payroll.fields.account}</p>
              <p className="font-medium text-gray-900">{run.account?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-gray-500">{tr.payroll.fields.paidAt}</p>
              <p className="font-medium text-gray-900">{run.paidAt ? formatDateTR(new Date(run.paidAt)) : "—"}</p>
            </div>
          </>
        )}
      </div>

      {run.status === "DRAFT" && <p className="mb-4 rounded-md bg-amber-50 p-3 text-xs text-amber-800">{tr.payroll.disclaimer}</p>}

      <PayrollItemsTable
        runId={run.id}
        editable={canEdit}
        items={run.items.map((it) => ({
          id: it.id,
          employeeId: it.employeeId,
          employeeName: it.employee.fullName,
          grossSalary: it.grossSalary.toString(),
          employeeSgkCut: it.employeeSgkCut.toString(),
          unemploymentCut: it.unemploymentCut.toString(),
          incomeTax: it.incomeTax.toString(),
          stampTax: it.stampTax.toString(),
          employerSgkCost: it.employerSgkCost.toString(),
          netSalary: it.netSalary.toString(),
        }))}
      />
    </div>
  );
}
