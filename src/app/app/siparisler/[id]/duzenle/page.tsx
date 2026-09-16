import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { getOrder } from "@/lib/modules/orders/service";
import { withTenant } from "@/lib/db/tenant-context";
import { getRequiredScope } from "@/lib/auth/rbac";
import { tr } from "@/lib/i18n/tr";
import { OrderForm } from "../../_components/order-form";

export default async function SiparisDuzenlePage({ params }: { params: { id: string } }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const scope = getRequiredScope(session.role, "order", "edit");
  if (!scope) return <p className="text-sm text-gray-500">Bu kaydı düzenleme yetkiniz yok.</p>;

  const result = await getOrder(session, params.id);
  if (!result.ok) return <p className="text-sm text-red-600">{result.message}</p>;
  const order = result.data;

  if (order.status === "CANCELLED") {
    return <p className="text-sm text-amber-700">İptal edilmiş sipariş düzenlenemez.</p>;
  }

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
      <h1 className="mb-6 text-lg font-semibold text-gray-900">{tr.order.edit}</h1>
      <OrderForm
        mode="edit"
        orderId={order.id}
        quoteId={order.quoteId ?? undefined}
        initialValues={{
          customerId: order.customerId,
          orderDate: new Date(order.orderDate).toISOString().slice(0, 10),
          dueDate: order.dueDate ? new Date(order.dueDate).toISOString().slice(0, 10) : "",
          deliveryAddress: order.deliveryAddress ?? "",
          ownerUserId: order.ownerUserId,
          note: order.note ?? "",
          documentDiscountType: order.documentDiscountType ?? "PERCENT",
          documentDiscountValue: order.documentDiscountValue ? String(order.documentDiscountValue) : "0",
          items: order.items.map((item) => ({
            id: item.id,
            productId: item.productId ?? "",
            description: item.description,
            quantity: String(item.quantity),
            unit: item.unit,
            unitPrice: String(item.unitPrice),
            unitCost: item.unitCost != null ? String(item.unitCost) : "",
            discountType: item.discountType,
            discountValue: String(item.discountValue),
            vatRate: String(item.vatRate),
          })),
          paymentSchedules: order.paymentSchedules.map((s) => ({
            dueDate: new Date(s.dueDate).toISOString().slice(0, 10),
            amount: String(s.amount),
            description: s.description ?? "",
          })),
        }}
        customers={customers}
        products={products.map((p) => ({ id: p.id, name: p.name, unit: p.unit, listPrice: Number(p.listPrice), vatRate: Number(p.vatRate), defaultCost: p.defaultCost != null ? Number(p.defaultCost) : null }))}
        users={users.map((m) => ({ id: m.user.id, name: m.user.name }))}
        canAssignOwner={scope === "all"}
      />
    </div>
  );
}
