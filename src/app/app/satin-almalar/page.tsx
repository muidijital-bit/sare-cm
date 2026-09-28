import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { listPurchaseOrders } from "@/lib/modules/purchase-orders/service";
import { listPurchaseOrdersQuerySchema } from "@/lib/validation/purchase-order";
import { getScope } from "@/lib/auth/access";
import { AccessDenied } from "@/components/ui/access-denied";
import { tr, formatCurrencyTRY, formatDateTR } from "@/lib/i18n/tr";
import { Badge, PURCHASE_ORDER_STATUS_COLORS } from "@/components/ui/badge";

export default async function SatinAlmalarPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const scope = getScope(session, "supplier", "view");
  if (!scope) return <AccessDenied session={session} module="supplier" />;

  const parsed = listPurchaseOrdersQuerySchema.safeParse(searchParams);
  const query = parsed.success ? parsed.data : { page: 1, pageSize: 20 };
  const result = await listPurchaseOrders(session, query);
  if (!result.ok) return <p className="text-sm text-red-600">{result.message}</p>;

  const { items, total, page, pageSize } = result.data;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canCreate = !!getScope(session, "supplier", "create");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">{tr.purchaseOrder.title}</h1>
        <div className="flex items-center gap-3">
          <Link href="/app/tedarikciler" className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {tr.supplier.title}
          </Link>
          <Link href="/app/satin-almalar/stok" className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {tr.stock.title}
          </Link>
          {canCreate && (
            <Link href="/app/satin-almalar/yeni" className="rounded-md bg-brand-800 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
              + {tr.purchaseOrder.new}
            </Link>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">{tr.purchaseOrder.fields.number}</th>
              <th className="px-4 py-3">{tr.purchaseOrder.fields.supplier}</th>
              <th className="px-4 py-3">{tr.purchaseOrder.fields.orderedAt}</th>
              <th className="px-4 py-3">{tr.purchaseOrder.fields.status}</th>
              <th className="px-4 py-3 text-right">{tr.purchaseOrder.fields.total}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  {tr.purchaseOrder.empty}
                </td>
              </tr>
            )}
            {items.map((po) => (
              <tr key={po.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/app/satin-almalar/${po.id}`} className="font-medium text-gray-900 hover:underline">
                    {po.number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{po.supplier.title}</td>
                <td className="px-4 py-3 text-gray-600">{formatDateTR(new Date(po.orderedAt))}</td>
                <td className="px-4 py-3">
                  <Badge color={PURCHASE_ORDER_STATUS_COLORS[po.status]}>{tr.purchaseOrder.status[po.status as keyof typeof tr.purchaseOrder.status]}</Badge>
                </td>
                <td className="px-4 py-3 text-right text-gray-900">{formatCurrencyTRY(Number(po.total))}</td>
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
              href={{ pathname: "/app/satin-almalar", query: { ...searchParams, page: p } }}
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
