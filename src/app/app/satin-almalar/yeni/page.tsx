import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/tenant-context";
import { getScope } from "@/lib/auth/access";
import { tr } from "@/lib/i18n/tr";
import { PurchaseOrderForm } from "../_components/purchase-order-form";

export default async function YeniSatinAlmaPage() {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  if (!getScope(session, "supplier", "create")) {
    return <p className="text-sm text-gray-500">Alım oluşturma yetkiniz yok.</p>;
  }

  const [suppliers, products] = await withTenant(session.companyId, (tx) =>
    Promise.all([
      tx.supplier.findMany({ where: { deletedAt: null, isActive: true }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
      tx.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, defaultCost: true, vatRate: true } }),
    ]),
  );

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-lg font-semibold text-gray-900">{tr.purchaseOrder.new}</h1>
      <PurchaseOrderForm
        suppliers={suppliers}
        products={products.map((p) => ({ id: p.id, name: p.name, defaultCost: p.defaultCost != null ? Number(p.defaultCost) : null, vatRate: Number(p.vatRate) }))}
      />
    </div>
  );
}
