import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { getScope } from "@/lib/auth/access";
import { tr } from "@/lib/i18n/tr";
import { EmployeeForm } from "../_components/employee-form";

export default async function YeniPersonelPage() {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  if (!getScope(session, "employee", "create")) {
    return <p className="text-sm text-gray-500">Personel ekleme yetkiniz yok.</p>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-lg font-semibold text-gray-900">{tr.employee.new}</h1>
      <EmployeeForm mode="create" />
    </div>
  );
}
