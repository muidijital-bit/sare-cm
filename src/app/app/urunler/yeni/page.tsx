import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { getScope } from "@/lib/auth/access";
import { tr } from "@/lib/i18n/tr";
import { ProductForm } from "../_components/product-form";

export default async function YeniUrunPage() {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  if (!getScope(session, "product", "create")) {
    return <p className="text-sm text-gray-500">Ürün ekleme yetkiniz yok.</p>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-gray-800">{tr.product.new}</h1>
      <ProductForm mode="create" />
    </div>
  );
}
