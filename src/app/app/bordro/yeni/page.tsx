import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { getScope } from "@/lib/auth/access";
import { tr } from "@/lib/i18n/tr";
import { PayrollRunForm } from "../_components/payroll-run-form";

export default async function YeniBordroPage() {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  if (!getScope(session, "payroll", "create")) {
    return <p className="text-sm text-gray-500">Bordro dönemi açma yetkiniz yok.</p>;
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-lg font-semibold text-gray-900">{tr.payroll.new}</h1>
      <PayrollRunForm />
    </div>
  );
}
