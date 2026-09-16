import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { getPayment } from "@/lib/modules/payments/service";
import { getRequiredScope } from "@/lib/auth/rbac";
import { tr, formatCurrencyTRY, formatDateTR } from "@/lib/i18n/tr";
import { Badge } from "@/components/ui/badge";
import { CancelPaymentButton } from "../_components/cancel-payment-button";

export default async function TahsilatDetayPage({ params }: { params: { id: string } }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const result = await getPayment(session, params.id);
  if (!result.ok) return <p className="text-sm text-red-600">{result.message}</p>;
  const payment = result.data;

  const canCancel = !!getRequiredScope(session.role, "payment", "delete") && !payment.isCancelled;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{formatCurrencyTRY(Number(payment.amount))}</h1>
          <p className="text-sm text-gray-500">
            {formatDateTR(new Date(payment.paidAt))} · {tr.payment.method[payment.method]}
          </p>
          {payment.isCancelled && <Badge color="gray">{tr.payment.cancelled}</Badge>}
        </div>
        {canCancel && <CancelPaymentButton paymentId={payment.id} />}
      </div>

      {payment.isCancelled && payment.cancelReason && (
        <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">İptal gerekçesi: {payment.cancelReason}</div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">{tr.document.customer}</dt>
            <dd>
              <Link href={`/app/musteriler/${payment.customer.id}`} className="text-gray-900 hover:underline">
                {payment.customer.title}
              </Link>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">{tr.payment.fields.account}</dt>
            <dd className="text-gray-900">{payment.account.name}</dd>
          </div>
          {payment.reference && (
            <div className="flex justify-between">
              <dt className="text-gray-500">{tr.payment.fields.reference}</dt>
              <dd className="text-gray-900">{payment.reference}</dd>
            </div>
          )}
          {payment.note && (
            <div className="flex justify-between">
              <dt className="text-gray-500">{tr.payment.fields.note}</dt>
              <dd className="text-gray-900">{payment.note}</dd>
            </div>
          )}
        </dl>
      </div>

      {payment.allocations.length > 0 && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">{tr.payment.fields.allocations}</h2>
          <ul className="space-y-1 text-sm">
            {payment.allocations.map((a) => (
              <li key={a.id} className="flex justify-between">
                <Link href={`/app/siparisler/${a.order.id}`} className="text-gray-900 hover:underline">
                  {a.order.number}
                </Link>
                <span className="text-gray-900">{formatCurrencyTRY(Number(a.amount))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
