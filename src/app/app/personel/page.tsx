import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { listEmployees } from "@/lib/modules/employees/service";
import { listEmployeesQuerySchema } from "@/lib/validation/employee";
import { getScope } from "@/lib/auth/access";
import { AccessDenied } from "@/components/ui/access-denied";
import { tr, formatCurrencyTRY } from "@/lib/i18n/tr";
import { Badge, EMPLOYEE_STATUS_COLORS } from "@/components/ui/badge";
import { EmployeeFilterBar } from "./_components/employee-filter-bar";

export default async function PersonelPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const scope = getScope(session, "employee", "view");
  if (!scope) return <AccessDenied session={session} module="employee" />;

  const parsed = listEmployeesQuerySchema.safeParse(searchParams);
  const query = parsed.success ? parsed.data : { page: 1, pageSize: 20 };
  const result = await listEmployees(session, query);
  if (!result.ok) return <p className="text-sm text-red-600">{result.message}</p>;

  const { items, total, page, pageSize } = result.data;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canCreate = !!getScope(session, "employee", "create");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">{tr.employee.title}</h1>
        {canCreate && (
          <Link href="/app/personel/yeni" className="rounded-lg bg-brand-800 shadow-theme-xs px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            + {tr.employee.new}
          </Link>
        )}
      </div>

      <EmployeeFilterBar rowCount={items.length} />

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-theme-xs">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-theme-xs font-medium text-gray-500">
            <tr>
              <th className="px-4 py-3">{tr.employee.fields.fullName}</th>
              <th className="px-4 py-3">{tr.employee.fields.position}</th>
              <th className="px-4 py-3">{tr.employee.fields.department}</th>
              <th className="px-4 py-3 text-right">{tr.employee.fields.grossSalary}</th>
              <th className="px-4 py-3">{tr.employee.fields.status}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  {tr.employee.empty}
                </td>
              </tr>
            )}
            {items.map((e) => (
              <tr
                key={e.id}
                className="searchable-row-employees hover:bg-gray-50"
                data-search={[e.fullName, e.position, e.department].filter(Boolean).join(" ")}
              >
                <td className="px-4 py-3">
                  <Link href={`/app/personel/${e.id}`} className="font-medium text-gray-900 hover:underline">
                    {e.fullName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{e.position ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{e.department ?? "—"}</td>
                <td className="px-4 py-3 text-right text-gray-900">{formatCurrencyTRY(Number(e.grossSalary))}</td>
                <td className="px-4 py-3">
                  <Badge color={EMPLOYEE_STATUS_COLORS[e.status]}>{tr.employee.status[e.status as keyof typeof tr.employee.status]}</Badge>
                </td>
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
              href={{ pathname: "/app/personel", query: { ...searchParams, page: p } }}
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
