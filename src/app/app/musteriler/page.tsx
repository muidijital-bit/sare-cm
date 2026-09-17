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
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { RowDeleteButton } from "@/components/ui/row-delete-button";

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

  // PERFORMANS: üç sorgu TEK transaction'da — her ayrı withTenant() çağrısı Neon'a tam bir
  // transaction round-trip'i (ölçüldü: ~1,4sn) demek ve bunlar Promise.all ile bile gerçek
  // anlamda paralelleşmiyor (3 ayrı çağrı ~4sn sürüyordu). Tek transaction'da ~1,4sn.
  const [result, sources, users] = await withTenant(session.companyId, (tx) =>
    Promise.all([
      listCustomers(session, query, tx),
      tx.customerSource.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      scope === "all"
        ? tx.membership.findMany({
            where: { isActive: true },
            include: { user: { select: { id: true, name: true } } },
            orderBy: { user: { name: "asc" } },
          })
        : Promise.resolve([] as { user: { id: string; name: string } }[]),
    ]),
  );

  if (!result.ok) {
    return <p className="text-sm text-red-600">{result.message}</p>;
  }

  const { items, total, page, pageSize } = result.data;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const editScope = getRequiredScope(session.role, "customer", "edit");
  const deleteScope = getRequiredScope(session.role, "customer", "delete");
  const canDelete = !!deleteScope;
  const canShowActions = !!editScope || !!deleteScope;

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
        rowCount={items.length}
      />

      {canDelete && (
        <BulkActionBar
          rowSelector="row-select-customers"
          selectAllSelector="row-select-all-customers"
          entityLabel="müşteri"
          actions={[
            {
              key: "delete",
              label: tr.customer.bulkDelete,
              endpoint: "/api/customers/bulk-delete",
              variant: "danger",
              confirmMessage: tr.customer.bulkDeleteConfirm,
            },
          ]}
        />
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              {canDelete && (
                <th className="w-8 px-4 py-3">
                  <input type="checkbox" className="row-select-all-customers" aria-label="Tümünü seç" />
                </th>
              )}
              <th className="px-4 py-3">{tr.customer.fields.title}</th>
              <th className="px-4 py-3">{tr.customer.fields.type}</th>
              <th className="px-4 py-3">{tr.customer.fields.status}</th>
              <th className="px-4 py-3">{tr.customer.fields.source}</th>
              <th className="px-4 py-3">{tr.customer.fields.tags}</th>
              {canShowActions && <th className="px-4 py-3">İşlemler</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  {tr.customer.empty}
                </td>
              </tr>
            )}
            {items.map((c) => {
              const rowCanEdit = !!editScope && (editScope === "all" || c.ownerUserId === session.userId);
              const rowCanDelete = !!deleteScope && (deleteScope === "all" || c.ownerUserId === session.userId);
              return (
                <tr
                  key={c.id}
                  className="searchable-row-customers hover:bg-gray-50"
                  data-search={[c.title, c.taxNumber, c.source?.name, tr.customer.status[c.status], tr.customer.type[c.type]]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {canDelete && (
                    <td className="px-4 py-3">
                      <input type="checkbox" className="row-select-customers" data-id={c.id} />
                    </td>
                  )}
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
                  {canShowActions && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {rowCanEdit && (
                          <Link href={`/app/musteriler/${c.id}/duzenle`} className="text-xs text-gray-600 hover:underline">
                            {tr.customer.edit}
                          </Link>
                        )}
                        {rowCanDelete && <RowDeleteButton endpoint={`/api/customers/${c.id}`} confirmMessage={tr.customer.deleteConfirm} label={tr.customer.delete} />}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
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
