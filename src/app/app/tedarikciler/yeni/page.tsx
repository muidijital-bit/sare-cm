import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { getScope } from "@/lib/auth/access";
import { tr } from "@/lib/i18n/tr";
import { SupplierForm } from "../_components/supplier-form";

export default async function YeniTedarikciPage() {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  if (!getScope(session, "supplier", "create")) {
    return <p className="text-sm text-gray-500">Tedarikçi ekleme yetkiniz yok.</p>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-gray-800">{tr.supplier.new}</h1>
      <SupplierForm mode="create" />
    </div>
  );
}
