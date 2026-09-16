import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { getOrder, computePaymentStatus } from "@/lib/modules/orders/service";
import { getRequiredScope } from "@/lib/auth/rbac";
import { tr, formatCurrencyTRY, formatDateTR } from "@/lib/i18n/tr";
import { Badge, ORDER_STATUS_COLORS } from "@/components/ui/badge";
import { OrderActions } from "../_components/order-actions";

export default async function SiparisDetayPage({ params }: { params: { id: string } }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const result = await getOrder(session, params.id);
  if (!result.ok) return <p className="text-sm text-red-600">{result.message}</p>;
  const order = result.data;
  const paymentStatus = computePaymentStatus(order);

  const editScope = getRequiredScope(session.role, "order", "edit");
  const canEdit = !!editScope && (editScope === "all" || order.ownerUserId === session.userId);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{order.number}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge color={ORDER_STATUS_COLORS[order.status]}>{tr.order.status[order.status]}</Badge>
            <Link href={`/app/musteriler/${order.customer.id}`} className="text-sm text-gray-600 hover:underline">
              {order.customer.title}
            </Link>
            {order.quote && (
              <Link href={`/app/teklifler/${order.quote.id}`} className="text-xs text-gray-400 hover:underline">
                ({tr.order.fromQuote}: {order.quote.number})
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {order.status !== "CANCELLED" && canEdit && (
            <Link href={`/app/siparisler/${order.id}/duzenle`} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
              {tr.order.edit}
            </Link>
          )}
          <OrderActions orderId={order.id} status={order.status} canEdit={canEdit} />
        </div>
      </div>

      {order.status === "CANCELLED" && order.cancelReason && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          İptal gerekçesi: {order.cancelReason}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">{tr.document.description}</th>
                  <th className="px-3 py-2 text-right">{tr.document.quantity}</th>
                  <th className="px-3 py-2 text-right">{tr.document.unitPrice}</th>
                  <th className="px-3 py-2 text-right">{tr.document.lineTotal}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2">{item.description}</td>
                    <td className="px-3 py-2 text-right">
                      {Number(item.quantity)} {item.unit}
                    </td>
                    <td className="px-3 py-2 text-right">{formatCurrencyTRY(Number(item.unitPrice))}</td>
                    <td className="px-3 py-2 text-right">{formatCurrencyTRY(Number(item.lineTotal))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {order.paymentSchedules.length > 0 && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-gray-900">{tr.order.paymentSchedule}</h2>
              <ul className="space-y-1 text-sm">
                {order.paymentSchedules.map((s) => (
                  <li key={s.id} className="flex justify-between">
                    <span className="text-gray-600">
                      {formatDateTR(new Date(s.dueDate))} {s.description && `· ${s.description}`}
                    </span>
                    <span className="text-gray-900">{formatCurrencyTRY(Number(s.amount))}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {order.note && <div className="mt-4 rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-700">{order.note}</div>}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">SP-07 Ödeme Durumu</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">{tr.order.paymentStatus.total}</dt>
                <dd className="text-gray-900">{formatCurrencyTRY(paymentStatus.total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">{tr.order.paymentStatus.collected}</dt>
                <dd className="text-green-700">{formatCurrencyTRY(paymentStatus.collected)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">{tr.order.paymentStatus.remaining}</dt>
                <dd className="text-gray-900">{formatCurrencyTRY(paymentStatus.remaining)}</dd>
              </div>
              {paymentStatus.overdue > 0 && (
                <div className="flex justify-between">
                  <dt className="text-red-600">{tr.order.paymentStatus.overdue}</dt>
                  <dd className="text-red-600">{formatCurrencyTRY(paymentStatus.overdue)}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">{tr.document.orderDate}</dt>
                <dd className="text-gray-900">{formatDateTR(new Date(order.orderDate))}</dd>
              </div>
              {order.dueDate && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">{tr.document.dueDate}</dt>
                  <dd className="text-gray-900">{formatDateTR(new Date(order.dueDate))}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold">
                <dt className="text-gray-900">{tr.document.grandTotal}</dt>
                <dd className="text-gray-900">{formatCurrencyTRY(Number(order.grandTotal))}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
