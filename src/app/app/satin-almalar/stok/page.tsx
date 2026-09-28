import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/tenant-context";
import { getScope } from "@/lib/auth/access";
import { AccessDenied } from "@/components/ui/access-denied";
import { tr, formatCurrencyTRY } from "@/lib/i18n/tr";

/**
 * Ürün kataloğu CRUD'u artık /app/urunler altında var (Ürün Yönetimi modülü) — bu sayfa
 * mevcut ürünlerin stok/maliyet durumunu gösterir, ürün ekleme/düzenleme oraya bağlanır.
 */
export default async function StokPage() {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  if (!getScope(session, "supplier", "view")) return <AccessDenied session={session} module="supplier" />;

  const products = await withTenant(session.companyId, (tx) => tx.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }));
  const canManageProducts = !!getScope(session, "product", "create");

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

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-theme-xs">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-theme-xs font-medium text-gray-500">
            <tr>
              <th className="px-4 py-3">Ürün</th>
              <th className="px-4 py-3 text-right">{tr.stock.current}</th>
              <th className="px-4 py-3 text-right">{tr.stock.cost}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                  {tr.product.empty}
                </td>
              </tr>
            )}
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/app/satin-almalar/stok/${p.id}`} className="font-medium text-gray-900 hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className={`px-4 py-3 text-right ${Number(p.stockQty) < 0 ? "font-medium text-red-600" : "text-gray-900"}`}>
                  {p.stockQty.toString()} {p.unit}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">{p.defaultCost != null ? formatCurrencyTRY(Number(p.defaultCost)) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
