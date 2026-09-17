import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/tenant-context";
import { listOrders } from "@/lib/modules/orders/service";
import { listOrdersQuerySchema } from "@/lib/validation/order";
import { getRequiredScope } from "@/lib/auth/rbac";
import { tr, formatCurrencyTRY, formatDateTR } from "@/lib/i18n/tr";
import { Badge, ORDER_STATUS_COLORS } from "@/components/ui/badge";
import { OrderFilterBar } from "./_components/order-filter-bar";

export default async function SiparislerPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const scope = getRequiredScope(session.role, "order", "view");
  if (!scope) return <p className="text-sm text-gray-500">Bu modülü görüntüleme yetkiniz yok.</p>;

  const parsed = listOrdersQuerySchema.safeParse(searchParams);
  const query = parsed.success ? parsed.data : { page: 1, pageSize: 20 };
  const [result, users] = await Promise.all([
    listOrders(session, query),
    scope === "all"
      ? withTenant(session.companyId, (tx) =>
          tx.membership.findMany({
            where: { isActive: true },
            include: { user: { select: { id: true, name: true } } },
            orderBy: { user: { name: "asc" } },
          }),
        )
      : Promise.resolve([]),
  ]);
  if (!result.ok) return <p className="text-sm text-red-600">{result.message}</p>;

  const { items, total, page, pageSize } = result.data;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canCreate = !!getRequiredScope(session.role, "order", "create");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">{tr.order.title}</h1>
        {canCreate && (
          <Link href="/app/siparisler/yeni" className="rounded-md bg-brand-800 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            + {tr.order.new}
          </Link>
        )}
      </div>

      <OrderFilterBar showOwnerFilter={scope === "all"} users={users.map((m) => ({ id: m.user.id, name: m.user.name }))} />

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">No</th>
              <th className="px-4 py-3">{tr.document.customer}</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">{tr.document.dueDate}</th>
              <th className="px-4 py-3 text-right">{tr.document.grandTotal}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  {tr.order.empty}
                </td>
              </tr>
            )}
            {items.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/app/siparisler/${o.id}`} className="font-medium text-gray-900 hover:underline">
                    {o.number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{o.customer.title}</td>
                <td className="px-4 py-3">
                  <Badge color={ORDER_STATUS_COLORS[o.status]}>{tr.order.status[o.status]}</Badge>
                </td>
                <td className="px-4 py-3 text-gray-600">{o.dueDate ? formatDateTR(new Date(o.dueDate)) : "—"}</td>
                <td className="px-4 py-3 text-right text-gray-900">{formatCurrencyTRY(Number(o.grandTotal))}</td>
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
              href={{ pathname: "/app/siparisler", query: { ...searchParams, page: p } }}
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
