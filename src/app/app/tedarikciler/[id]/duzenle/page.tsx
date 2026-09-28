import { redirect, notFound } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { getSupplier } from "@/lib/modules/suppliers/service";
import { getScope } from "@/lib/auth/access";
import { tr } from "@/lib/i18n/tr";
import { SupplierForm } from "../../_components/supplier-form";

export default async function TedarikciDuzenlePage({ params }: { params: { id: string } }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  if (!getScope(session, "supplier", "edit")) {
    return <p className="text-sm text-gray-500">Bu kaydı düzenleme yetkiniz yok.</p>;
  }

  const result = await getSupplier(session, params.id);
  if (!result.ok) {
    if (result.status === 404) notFound();
    return <p className="text-sm text-red-600">{result.message}</p>;
  }
  const s = result.data;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-gray-800">{tr.supplier.edit}</h1>
      <SupplierForm
        mode="edit"
        supplierId={s.id}
        initialValues={{
          title: s.title,
          taxOffice: s.taxOffice ?? "",
          taxNumber: s.taxNumber ?? "",
          address: s.address ?? "",
          phone: s.phone ?? "",
          email: s.email ?? "",
          isActive: s.isActive,
        }}
      />
    </div>
  );
}
