import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { getEmployee } from "@/lib/modules/employees/service";
import { getScope } from "@/lib/auth/access";
import { AccessDenied } from "@/components/ui/access-denied";
import { tr, formatCurrencyTRY, formatDateTR } from "@/lib/i18n/tr";
import { Badge, EMPLOYEE_STATUS_COLORS } from "@/components/ui/badge";
import { RowDeleteButton } from "@/components/ui/row-delete-button";
import { LeaveForm } from "./_components/leave-form";

export default async function PersonelDetayPage({ params }: { params: { id: string } }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const scope = getScope(session, "employee", "view");
  if (!scope) return <AccessDenied session={session} module="employee" />;

  const result = await getEmployee(session, params.id);
  if (!result.ok) {
    if (result.status === 404) notFound();
    return <p className="text-sm text-red-600">{result.message}</p>;
  }
  const e = result.data;
  const canEdit = !!getScope(session, "employee", "edit");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/app/personel" className="text-xs text-brand-700 hover:underline">
            ← {tr.employee.title}
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-gray-900">{e.fullName}</h1>
        </div>
        {canEdit && (
          <Link href={`/app/personel/${e.id}/duzenle`} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
            {tr.employee.edit}
          </Link>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg border border-gray-200 bg-white p-4 text-sm sm:grid-cols-4">
        <div>
          <p className="text-gray-500">{tr.employee.fields.position}</p>
          <p className="font-medium text-gray-900">{e.position ?? "—"}</p>
        </div>
        <div>
          <p className="text-gray-500">{tr.employee.fields.department}</p>
          <p className="font-medium text-gray-900">{e.department ?? "—"}</p>
        </div>
        <div>
          <p className="text-gray-500">{tr.employee.fields.status}</p>
          <Badge color={EMPLOYEE_STATUS_COLORS[e.status]}>{tr.employee.status[e.status as keyof typeof tr.employee.status]}</Badge>
        </div>
        <div>
          <p className="text-gray-500">{tr.employee.fields.grossSalary}</p>
          <p className="font-medium text-gray-900">{formatCurrencyTRY(Number(e.grossSalary))}</p>
        </div>
        <div>
          <p className="text-gray-500">{tr.employee.fields.hireDate}</p>
          <p className="font-medium text-gray-900">{formatDateTR(new Date(e.hireDate))}</p>
        </div>
        <div>
          <p className="text-gray-500">{tr.employee.fields.nationalId}</p>
          <p className="font-medium text-gray-900">{e.nationalId ?? "—"}</p>
        </div>
        <div>
          <p className="text-gray-500">{tr.employee.fields.sgkSicilNo}</p>
          <p className="font-medium text-gray-900">{e.sgkSicilNo ?? "—"}</p>
        </div>
        <div>
          <p className="text-gray-500">{tr.employee.fields.iban}</p>
          <p className="font-medium text-gray-900">{e.iban ?? "—"}</p>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">{tr.employee.leave.title}</h2>
        {canEdit && <LeaveForm employeeId={e.id} />}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">{tr.employee.leave.fields.type}</th>
              <th className="px-4 py-3">{tr.employee.leave.fields.startDate}</th>
              <th className="px-4 py-3">{tr.employee.leave.fields.endDate}</th>
              <th className="px-4 py-3 text-right">{tr.employee.leave.fields.days}</th>
              <th className="px-4 py-3">{tr.employee.leave.fields.note}</th>
              {canEdit && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {e.leaveRequests.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  {tr.employee.leave.empty}
                </td>
              </tr>
            )}
            {e.leaveRequests.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3 text-gray-900">{tr.employee.leave.type[l.type as keyof typeof tr.employee.leave.type]}</td>
                <td className="px-4 py-3 text-gray-600">{formatDateTR(new Date(l.startDate))}</td>
                <td className="px-4 py-3 text-gray-600">{formatDateTR(new Date(l.endDate))}</td>
                <td className="px-4 py-3 text-right text-gray-900">{l.days.toString()}</td>
                <td className="px-4 py-3 text-gray-600">{l.note ?? "—"}</td>
                {canEdit && (
                  <td className="px-4 py-3 text-right">
                    <RowDeleteButton endpoint={`/api/leave-requests/${l.id}`} confirmMessage={tr.employee.leave.deleteConfirm} label={tr.employee.delete} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
