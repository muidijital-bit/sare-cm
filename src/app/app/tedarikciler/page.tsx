import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { listSuppliers } from "@/lib/modules/suppliers/service";
import { listSuppliersQuerySchema } from "@/lib/validation/supplier";
import { getScope } from "@/lib/auth/access";
import { AccessDenied } from "@/components/ui/access-denied";
import { tr } from "@/lib/i18n/tr";
import { RowDeleteButton } from "@/components/ui/row-delete-button";
import { SupplierFilterBar } from "./_components/supplier-filter-bar";

export default async function TedarikcilerPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const scope = getScope(session, "supplier", "view");
  if (!scope) return <AccessDenied session={session} module="supplier" />;

  const parsed = listSuppliersQuerySchema.safeParse(searchParams);
  const query = parsed.success ? parsed.data : { page: 1, pageSize: 20 };
  const result = await listSuppliers(session, query);
  if (!result.ok) return <p className="text-sm text-red-600">{result.message}</p>;

  const { items, total, page, pageSize } = result.data;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canCreate = !!getScope(session, "supplier", "create");
  const canDelete = !!getScope(session, "supplier", "delete");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">{tr.supplier.title}</h1>
        <div className="flex items-center gap-3">
          <Link href="/app/satin-almalar" className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {tr.purchaseOrder.title}
          </Link>
          <Link href="/app/satin-almalar/stok" className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {tr.stock.title}
          </Link>
          {canCreate && (
            <Link href="/app/tedarikciler/yeni" className="rounded-lg bg-brand-800 shadow-theme-xs px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
              + {tr.supplier.new}
            </Link>
          )}
        </div>
      </div>

      <SupplierFilterBar rowCount={items.length} />

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-theme-xs">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-theme-xs font-medium text-gray-500">
            <tr>
              <th className="px-4 py-3">{tr.supplier.fields.title}</th>
              <th className="px-4 py-3">{tr.supplier.fields.taxNumber}</th>
              <th className="px-4 py-3">{tr.supplier.fields.phone}</th>
              <th className="px-4 py-3">{tr.supplier.fields.isActive}</th>
              {canDelete && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  {tr.supplier.empty}
                </td>
              </tr>
            )}
            {items.map((s) => (
              <tr key={s.id} className="searchable-row-suppliers hover:bg-gray-50" data-search={[s.title, s.taxNumber, s.phone].filter(Boolean).join(" ")}>
                <td className="px-4 py-3">
                  <Link href={`/app/tedarikciler/${s.id}/duzenle`} className="font-medium text-gray-900 hover:underline">
                    {s.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{s.taxNumber ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{s.phone ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{s.isActive ? "Aktif" : "Pasif"}</td>
                {canDelete && (
                  <td className="px-4 py-3 text-right">
                    <RowDeleteButton endpoint={`/api/suppliers/${s.id}`} confirmMessage={tr.supplier.deleteConfirm} label={tr.supplier.delete} />
                  </td>
                )}
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
              href={{ pathname: "/app/tedarikciler", query: { ...searchParams, page: p } }}
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
