import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { getPurchaseOrder } from "@/lib/modules/purchase-orders/service";
import { getScope } from "@/lib/auth/access";
import { AccessDenied } from "@/components/ui/access-denied";
import { tr, formatCurrencyTRY, formatDateTR } from "@/lib/i18n/tr";
import { Badge, PURCHASE_ORDER_STATUS_COLORS } from "@/components/ui/badge";
import { PurchaseOrderActions } from "../_components/purchase-order-actions";

export default async function SatinAlmaDetayPage({ params }: { params: { id: string } }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const scope = getScope(session, "supplier", "view");
  if (!scope) return <AccessDenied session={session} module="supplier" />;

  const result = await getPurchaseOrder(session, params.id);
  if (!result.ok) {
    if (result.status === 404) notFound();
    return <p className="text-sm text-red-600">{result.message}</p>;
  }
  const po = result.data;
  const canEdit = !!getScope(session, "supplier", "edit");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/app/satin-almalar" className="text-xs text-brand-700 hover:underline">
            ← {tr.purchaseOrder.title}
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-gray-900">{po.number}</h1>
        </div>
        <PurchaseOrderActions purchaseOrderId={po.id} status={po.status} canEdit={canEdit} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg border border-gray-200 bg-white p-4 text-sm sm:grid-cols-4">
        <div>
          <p className="text-gray-500">{tr.purchaseOrder.fields.supplier}</p>
          <p className="font-medium text-gray-900">{po.supplier.title}</p>
        </div>
        <div>
          <p className="text-gray-500">{tr.purchaseOrder.fields.orderedAt}</p>
          <p className="font-medium text-gray-900">{formatDateTR(new Date(po.orderedAt))}</p>
        </div>
        <div>
          <p className="text-gray-500">{tr.purchaseOrder.fields.status}</p>
          <Badge color={PURCHASE_ORDER_STATUS_COLORS[po.status]}>{tr.purchaseOrder.status[po.status as keyof typeof tr.purchaseOrder.status]}</Badge>
        </div>
        <div>
          <p className="text-gray-500">{tr.purchaseOrder.fields.total}</p>
          <p className="font-medium text-gray-900">{formatCurrencyTRY(Number(po.total))}</p>
        </div>
      </div>

      {po.note && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 text-sm">
          <p className="text-gray-500">{tr.purchaseOrder.fields.note}</p>
          <p className="text-gray-900">{po.note}</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">{tr.purchaseOrder.fields.item.description}</th>
              <th className="px-4 py-3 text-right">{tr.purchaseOrder.fields.item.quantity}</th>
              <th className="px-4 py-3 text-right">{tr.purchaseOrder.fields.item.unitCost}</th>
              <th className="px-4 py-3 text-right">{tr.purchaseOrder.fields.item.vatRate}</th>
              <th className="px-4 py-3 text-right">{tr.purchaseOrder.fields.item.lineTotal}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {po.items.map((it) => (
              <tr key={it.id}>
                <td className="px-4 py-3 text-gray-900">
                  {it.description}
                  {it.product && <span className="ml-1 text-xs text-gray-400">({it.product.name})</span>}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">{it.quantity.toString()}</td>
                <td className="px-4 py-3 text-right text-gray-600">{formatCurrencyTRY(Number(it.unitCost))}</td>
                <td className="px-4 py-3 text-right text-gray-600">%{it.vatRate.toString()}</td>
                <td className="px-4 py-3 text-right text-gray-900">{formatCurrencyTRY(Number(it.lineTotal))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
