import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/tenant-context";
import { getRequiredScope } from "@/lib/auth/rbac";
import { tr } from "@/lib/i18n/tr";
import { OrderForm } from "../_components/order-form";

export default async function YeniSiparisPage() {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const scope = getRequiredScope(session.role, "order", "create");
  if (!scope) return <p className="text-sm text-gray-500">Sipariş oluşturma yetkiniz yok.</p>;

  const [customers, products, users] = await Promise.all([
    withTenant(session.companyId, (tx) =>
      tx.customer.findMany({
        where: { deletedAt: null, ...(scope === "own" ? { ownerUserId: session.userId } : {}) },
        orderBy: { title: "asc" },
        select: { id: true, title: true },
      }),
    ),
    withTenant(session.companyId, (tx) => tx.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })),
    scope === "all"
      ? withTenant(session.companyId, (tx) =>
          tx.membership.findMany({ where: { isActive: true }, include: { user: { select: { id: true, name: true } } }, orderBy: { user: { name: "asc" } } }),
        )
      : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-lg font-semibold text-gray-900">{tr.order.new}</h1>
      <OrderForm
        mode="create"
        customers={customers}
        products={products.map((p) => ({ id: p.id, name: p.name, unit: p.unit, listPrice: Number(p.listPrice), vatRate: Number(p.vatRate), defaultCost: p.defaultCost != null ? Number(p.defaultCost) : null }))}
        users={users.map((m) => ({ id: m.user.id, name: m.user.name }))}
        canAssignOwner={scope === "all"}
      />
    </div>
  );
}
