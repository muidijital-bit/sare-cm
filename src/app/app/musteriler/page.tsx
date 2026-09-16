import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/tenant-context";
import { listCustomers } from "@/lib/modules/customers/service";
import { listCustomersQuerySchema } from "@/lib/validation/customer";
import { getRequiredScope } from "@/lib/auth/rbac";
import { tr } from "@/lib/i18n/tr";
import { Badge, CUSTOMER_STATUS_COLORS } from "@/components/ui/badge";
import { CustomerFilterBar } from "./_components/customer-filter-bar";

export default async function MusterilerPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const scope = getRequiredScope(session.role, "customer", "view");
  if (!scope) {
    return <p className="text-sm text-gray-500">Bu modülü görüntüleme yetkiniz yok.</p>;
  }

  const parsedQuery = listCustomersQuerySchema.safeParse(searchParams);
  const query = parsedQuery.success ? parsedQuery.data : { page: 1, pageSize: 20 };

  const [result, sources, users] = await Promise.all([
    listCustomers(session, query),
    withTenant(session.companyId, (tx) =>
      tx.customerSource.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ),
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

  if (!result.ok) {
    return <p className="text-sm text-red-600">{result.message}</p>;
  }

  const { items, total, page, pageSize } = result.data;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">{tr.customer.title}</h1>
        <Link
          href="/app/musteriler/yeni"
          className="rounded-md bg-brand-800 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + {tr.customer.new}
        </Link>
      </div>

      <CustomerFilterBar
        sources={sources}
        showOwnerFilter={scope === "all"}
        users={users.map((m) => ({ id: m.user.id, name: m.user.name }))}
      />

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">{tr.customer.fields.title}</th>
              <th className="px-4 py-3">{tr.customer.fields.type}</th>
              <th className="px-4 py-3">{tr.customer.fields.status}</th>
              <th className="px-4 py-3">{tr.customer.fields.source}</th>
              <th className="px-4 py-3">{tr.customer.fields.tags}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  {tr.customer.empty}
                </td>
              </tr>
            )}
            {items.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/app/musteriler/${c.id}`} className="font-medium text-gray-900 hover:underline">
                    {c.title}
                  </Link>
                  {c.taxNumber && <p className="text-xs text-gray-400">{c.taxNumber}</p>}
                </td>
                <td className="px-4 py-3 text-gray-600">{tr.customer.type[c.type]}</td>
                <td className="px-4 py-3">
                  <Badge color={CUSTOMER_STATUS_COLORS[c.status]}>{tr.customer.status[c.status]}</Badge>
                </td>
                <td className="px-4 py-3 text-gray-600">{c.source?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {c.tags.map((t) => (
                      <Badge key={t.tag.name} color="gray">
                        {t.tag.name}
                      </Badge>
                    ))}
                  </div>
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
              href={{ pathname: "/app/musteriler", query: { ...searchParams, page: p } }}
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
