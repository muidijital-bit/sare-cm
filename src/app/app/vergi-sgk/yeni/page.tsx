import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { getScope } from "@/lib/auth/access";
import { tr } from "@/lib/i18n/tr";
import { TaxObligationForm } from "../_components/tax-obligation-form";

export default async function YeniVergiSgkPage() {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  if (!getScope(session, "taxObligation", "create")) {
    return <p className="text-sm text-gray-500">Yükümlülük ekleme yetkiniz yok.</p>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-lg font-semibold text-gray-900">{tr.taxObligation.new}</h1>
      <TaxObligationForm />
    </div>
  );
}
