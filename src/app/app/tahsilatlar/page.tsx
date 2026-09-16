import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { listPayments, listOverdueReceivables } from "@/lib/modules/payments/service";
import { listPaymentsQuerySchema } from "@/lib/validation/payment";
import { getRequiredScope } from "@/lib/auth/rbac";
import { tr, formatCurrencyTRY, formatDateTR } from "@/lib/i18n/tr";
import { Badge } from "@/components/ui/badge";

export default async function TahsilatlarPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const scope = getRequiredScope(session.role, "payment", "view");
  if (!scope) return <p className="text-sm text-gray-500">Bu modülü görüntüleme yetkiniz yok.</p>;

  const parsed = listPaymentsQuerySchema.safeParse(searchParams);
  const query = parsed.success ? parsed.data : { page: 1, pageSize: 20 };
  const [result, overdueResult] = await Promise.all([listPayments(session, query), listOverdueReceivables(session)]);
  if (!result.ok) return <p className="text-sm text-red-600">{result.message}</p>;

  const { items, total, page, pageSize } = result.data;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canCreate = !!getRequiredScope(session.role, "payment", "create");
  const overdue = overdueResult.ok ? overdueResult.data : [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">{tr.payment.title}</h1>
        {canCreate && (
          <Link href="/app/tahsilatlar/yeni" className="rounded-md bg-brand-800 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            + {tr.payment.new}
          </Link>
        )}
      </div>

      {overdue.length > 0 && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-red-800">{tr.payment.overdueTitle}</h2>
          <ul className="space-y-1 text-sm">
            {overdue.map((r) => (
              <li key={r.orderId} className="flex justify-between">
                <span>
                  <Link href={`/app/siparisler/${r.orderId}`} className="font-medium text-red-900 hover:underline">
                    {r.orderNumber}
                  </Link>{" "}
                  <span className="text-red-700">— {r.customerTitle}</span>
                </span>
                <span className="text-red-900">
                  {formatCurrencyTRY(r.amount)} · {r.daysOverdue} {tr.payment.daysOverdue}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">{tr.payment.fields.paidAt}</th>
              <th className="px-4 py-3">{tr.document.customer}</th>
              <th className="px-4 py-3">{tr.payment.fields.method}</th>
              <th className="px-4 py-3">{tr.payment.fields.account}</th>
              <th className="px-4 py-3 text-right">{tr.payment.fields.amount}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  {tr.payment.empty}
                </td>
              </tr>
            )}
            {items.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/app/tahsilatlar/${p.id}`} className="font-medium text-gray-900 hover:underline">
                    {formatDateTR(new Date(p.paidAt))}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{p.customer.title}</td>
                <td className="px-4 py-3 text-gray-600">{tr.payment.method[p.method]}</td>
                <td className="px-4 py-3 text-gray-600">{p.account.name}</td>
                <td className={`px-4 py-3 text-right ${Number(p.amount) < 0 ? "text-red-600" : "text-gray-900"}`}>
                  {p.isCancelled && <Badge color="gray">{tr.payment.cancelled}</Badge>} {formatCurrencyTRY(Number(p.amount))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={{ pathname: "/app/tahsilatlar", query: { ...searchParams, page: p } }}
              className={`rounded-md px-3 py-1 ${p === page ? "bg-brand-800 text-white" : "text-gray-600 hover:bg-gray-100"}`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
