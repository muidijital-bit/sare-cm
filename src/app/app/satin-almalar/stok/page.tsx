import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { getScope } from "@/lib/auth/access";
import { AccessDenied } from "@/components/ui/access-denied";
import { listProducts } from "@/lib/modules/products/service";
import { listSupplierOptions } from "@/lib/modules/suppliers/service";
import { listProductsQuerySchema } from "@/lib/validation/product";
import { GridFilters } from "@/components/ui/grid-filters";
import { Pagination } from "@/components/ui/pagination";
import { Badge, tagColor } from "@/components/ui/badge";
import { exportKeyFor } from "@/lib/export/registry";
import { tr, formatCurrencyTRY } from "@/lib/i18n/tr";

/**
 * Ürün kataloğu CRUD'u /app/urunler altında (Ürün Yönetimi modülü) — bu sayfa aktif ürünlerin
 * stok/maliyet durumunu gösterir: arama, stok durumu ve tedarikçi filtresi, stok değeri, Excel.
 */
export default async function StokPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  if (!getScope(session, "supplier", "view")) return <AccessDenied session={session} module="supplier" />;

  const parsed = listProductsQuerySchema.safeParse({ active: "true", ...searchParams });
  const query = parsed.success ? parsed.data : { page: 1, pageSize: 20, active: "true" as const };
  const [result, supplierOptions] = await Promise.all([listProducts(session, query), listSupplierOptions(session)]);
  if (!result.ok) return <p className="text-sm text-red-600">{result.message}</p>;

  const { items, total, page, pageSize } = result.data;
  const canManageProducts = !!getScope(session, "product", "create");
  const pageValue = items.reduce((s, p) => s + (p.defaultCost != null && Number(p.stockQty) > 0 ? Number(p.defaultCost) * Number(p.stockQty) : 0), 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-800">{tr.stock.title}</h1>
        <div className="flex items-center gap-3">
          <Link href="/app/tedarikciler" className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {tr.supplier.title}
          </Link>
          <Link href="/app/satin-almalar" className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {tr.purchaseOrder.title}
          </Link>
          {canManageProducts && (
            <Link href="/app/urunler/yeni" className="rounded-lg bg-brand-800 shadow-theme-xs px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
              + {tr.product.new}
            </Link>
          )}
        </div>
      </div>

      <GridFilters
        exportKey={exportKeyFor(session, "stok")}
        search={{ rowSelector: "searchable-row-stock", placeholder: tr.product.searchPlaceholder }}
        rowCount={items.length}
        total={total}
        selects={[
          { param: "stock", placeholder: "Tüm stok durumları", options: [{ value: "negative", label: "Eksi stok" }, { value: "zero", label: "Stok yok (0)" }, { value: "positive", label: "Stokta var" }] },
          ...(supplierOptions.length > 0 ? [{ param: "supplierId", placeholder: "Tüm tedarikçiler", options: supplierOptions.map((s) => ({ value: s.id, label: s.title })) }] : []),
        ]}
      />

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-theme-xs">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-theme-xs font-medium text-gray-500">
            <tr>
              <th className="px-4 py-3">Ürün</th>
              <th className="px-4 py-3">{tr.product.fields.defaultSupplier}</th>
              <th className="px-4 py-3 text-right">{tr.stock.current}</th>
              <th className="px-4 py-3 text-right">{tr.stock.cost}</th>
              <th className="px-4 py-3 text-right">Stok Değeri</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  {tr.product.empty}
                </td>
              </tr>
            )}
            {items.map((p) => {
              const qty = Number(p.stockQty);
              return (
                <tr key={p.id} className="searchable-row-stock" data-search={[p.name, p.code, p.defaultSupplier?.title].filter(Boolean).join(" ")}>
                  <td className="px-4 py-3">
                    <Link href={`/app/satin-almalar/stok/${p.id}`} className="font-medium text-gray-900 hover:underline">
                      {p.name}
                    </Link>
                    {p.code && <p className="text-xs text-gray-400">{p.code}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {p.defaultSupplier ? (
                      <Badge color={tagColor(p.defaultSupplier.title)} dot={false}>
                        {p.defaultSupplier.title}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Badge color={qty < 0 ? "red" : qty === 0 ? "amber" : "green"}>
                      {p.stockQty.toString()} {p.unit}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{p.defaultCost != null ? formatCurrencyTRY(Number(p.defaultCost)) : "—"}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {p.defaultCost != null && qty > 0 ? formatCurrencyTRY(Number(p.defaultCost) * qty) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {items.length > 0 && (
            <tfoot className="border-t border-gray-200 bg-gray-50 text-sm">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-right font-medium text-gray-600">
                  Bu sayfadaki stok değeri
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrencyTRY(pageValue)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <Pagination pathname="/app/satin-almalar/stok" searchParams={searchParams} page={page} total={total} pageSize={pageSize} />
    </div>
  );
}
