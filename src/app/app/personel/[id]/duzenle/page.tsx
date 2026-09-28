import { redirect, notFound } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { getEmployee } from "@/lib/modules/employees/service";
import { getScope } from "@/lib/auth/access";
import { tr } from "@/lib/i18n/tr";
import { EmployeeForm } from "../../_components/employee-form";

function toDateInput(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export default async function PersonelDuzenlePage({ params }: { params: { id: string } }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  if (!getScope(session, "employee", "edit")) {
    return <p className="text-sm text-gray-500">Bu kaydı düzenleme yetkiniz yok.</p>;
  }

  const result = await getEmployee(session, params.id);
  if (!result.ok) {
    if (result.status === 404) notFound();
    return <p className="text-sm text-red-600">{result.message}</p>;
  }
  const e = result.data;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-gray-800">{tr.employee.edit}</h1>
      <EmployeeForm
        mode="edit"
        employeeId={e.id}
        initialValues={{
          fullName: e.fullName,
          nationalId: e.nationalId ?? "",
          position: e.position ?? "",
          department: e.department ?? "",
          phone: e.phone ?? "",
          email: e.email ?? "",
          hireDate: toDateInput(e.hireDate),
          terminationDate: toDateInput(e.terminationDate),
          sgkSicilNo: e.sgkSicilNo ?? "",
          iban: e.iban ?? "",
          grossSalary: e.grossSalary.toString(),
          status: e.status,
          note: e.note ?? "",
        }}
      />
    </div>
  );
}
