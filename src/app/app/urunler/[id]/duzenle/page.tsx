import { redirect, notFound } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { getProduct } from "@/lib/modules/products/service";
import { getScope } from "@/lib/auth/access";
import { tr } from "@/lib/i18n/tr";
import { ProductForm } from "../../_components/product-form";

export default async function UrunDuzenlePage({ params }: { params: { id: string } }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  if (!getScope(session, "product", "edit")) {
    return <p className="text-sm text-gray-500">Bu kaydı düzenleme yetkiniz yok.</p>;
  }

  const result = await getProduct(session, params.id);
  if (!result.ok) {
    if (result.status === 404) notFound();
    return <p className="text-sm text-red-600">{result.message}</p>;
  }
  const p = result.data;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-gray-800">{tr.product.edit}</h1>
      <ProductForm
        mode="edit"
        productId={p.id}
        initialValues={{
          code: p.code ?? "",
          name: p.name,
          unit: p.unit,
          listPrice: p.listPrice.toString(),
          defaultCost: p.defaultCost?.toString() ?? "",
          vatRate: p.vatRate.toString(),
          isActive: p.isActive,
        }}
      />
    </div>
  );
}
