import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/tenant-context";
import { getScope } from "@/lib/auth/access";
import { AccessDenied } from "@/components/ui/access-denied";
import { tr, formatCurrencyTRY } from "@/lib/i18n/tr";

/**
 * Ürün kataloğu CRUD'u henüz yok (bkz. src/app/api/products/route.ts notu) — bu sayfa mevcut
 * ürünlerin stok/maliyet durumunu gösterir, yeni ürün ekleme burada DEĞİLDİR.
 */
export default async function StokPage() {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  if (!getScope(session, "supplier", "view")) return <AccessDenied session={session} module="supplier" />;

  const products = await withTenant(session.companyId, (tx) => tx.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-gray-900">{tr.stock.title}</h1>
        <div className="flex items-center gap-3">
          <Link href="/app/tedarikciler" className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {tr.supplier.title}
          </Link>
          <Link href="/app/satin-almalar" className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {tr.purchaseOrder.title}
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
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
                  Aktif ürün yok. Ürünler, teklif/sipariş/satın alma formlarındaki &quot;Ürün&quot; seçicisinden bağımsız olarak henüz ayrı bir katalog ekranından yönetilmiyor.
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
