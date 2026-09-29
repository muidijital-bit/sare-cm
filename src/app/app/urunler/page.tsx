import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { listProducts } from "@/lib/modules/products/service";
import { listProductsQuerySchema } from "@/lib/validation/product";
import { getScope } from "@/lib/auth/access";
import { AccessDenied } from "@/components/ui/access-denied";
import { tr, formatCurrencyTRY } from "@/lib/i18n/tr";
import { RowDeleteButton } from "@/components/ui/row-delete-button";
import { GridFilters } from "@/components/ui/grid-filters";
import { Badge, tagColor } from "@/components/ui/badge";
import { exportKeyFor } from "@/lib/export/registry";
import { listSupplierOptions } from "@/lib/modules/suppliers/service";

export default async function UrunlerPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const scope = getScope(session, "product", "view");
  if (!scope) return <AccessDenied session={session} module="product" />;

  const parsed = listProductsQuerySchema.safeParse(searchParams);
  const query = parsed.success ? parsed.data : { page: 1, pageSize: 20 };
  const result = await listProducts(session, query);
  if (!result.ok) return <p className="text-sm text-red-600">{result.message}</p>;

  const { items, total, page, pageSize } = result.data;
  const supplierOptions = await listSupplierOptions(session);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canCreate = !!getScope(session, "product", "create");
  const canDelete = !!getScope(session, "product", "delete");

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-800">{tr.product.title}</h1>
        <div className="flex items-center gap-3">
          {getScope(session, "supplier", "view") && (
            <Link href="/app/satin-almalar/stok" className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              {tr.stock.title}
            </Link>
          )}
          {canCreate && (
            <Link href="/app/urunler/yeni" className="rounded-lg bg-brand-800 shadow-theme-xs px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
              + {tr.product.new}
            </Link>
          )}
        </div>
      </div>

      <GridFilters
        exportKey={exportKeyFor(session, "urunler")}
        search={{ rowSelector: "searchable-row-products", placeholder: tr.product.searchPlaceholder }}
        rowCount={items.length}
        total={total}
        selects={[
          { param: "active", placeholder: "Aktif + pasif", options: [{ value: "true", label: "Aktif" }, { value: "false", label: "Pasif" }] },
          { param: "stock", placeholder: "Tüm stok durumları", options: [{ value: "negative", label: "Eksi stok" }, { value: "zero", label: "Stok yok (0)" }, { value: "positive", label: "Stokta var" }] },
          ...(supplierOptions.length > 0 ? [{ param: "supplierId", placeholder: "Tüm tedarikçiler", options: supplierOptions.map((s) => ({ value: s.id, label: s.title })) }] : []),
        ]}
      />

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-theme-xs">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-theme-xs font-medium text-gray-500">
            <tr>
              <th className="px-4 py-3">{tr.product.fields.name}</th>
              <th className="px-4 py-3">{tr.product.fields.code}</th>
              <th className="px-4 py-3">{tr.product.fields.defaultSupplier}</th>
              <th className="px-4 py-3 text-right">{tr.product.fields.listPrice}</th>
              <th className="px-4 py-3 text-right">{tr.product.fields.stockQty}</th>
              <th className="px-4 py-3">{tr.product.fields.isActive}</th>
              {canDelete && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  {tr.product.empty}
                </td>
              </tr>
            )}
            {items.map((p) => (
              <tr key={p.id} className="searchable-row-products" data-search={[p.name, p.code].filter(Boolean).join(" ")}>
                <td className="px-4 py-3">
                  <Link href={`/app/urunler/${p.id}/duzenle`} className="font-medium text-gray-900 hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{p.code ?? "—"}</td>
                <td className="px-4 py-3">{p.defaultSupplier ? <Badge color={tagColor(p.defaultSupplier.title)} dot={false}>{p.defaultSupplier.title}</Badge> : <span className="text-gray-400">—</span>}</td>
                <td className="px-4 py-3 text-right text-gray-900">{formatCurrencyTRY(Number(p.listPrice))}</td>
                <td className={`px-4 py-3 text-right ${Number(p.stockQty) < 0 ? "font-medium text-red-600" : "text-gray-600"}`}>
                  {p.stockQty.toString()} {p.unit}
                </td>
                <td className="px-4 py-3">
                  <Badge color={p.isActive ? "green" : "gray"}>{p.isActive ? "Aktif" : "Pasif"}</Badge>
                </td>
                {canDelete && (
                  <td className="px-4 py-3 text-right">
                    <RowDeleteButton endpoint={`/api/products/${p.id}`} confirmMessage={tr.product.deleteConfirm} label={tr.product.delete} />
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
              href={{ pathname: "/app/urunler", query: { ...searchParams, page: p } }}
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
