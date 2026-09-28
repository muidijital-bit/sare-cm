import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/tenant-context";
import { getProductStock } from "@/lib/modules/purchase-orders/service";
import { getScope } from "@/lib/auth/access";
import { AccessDenied } from "@/components/ui/access-denied";
import { tr, formatCurrencyTRY, formatDateTR } from "@/lib/i18n/tr";
import { StockAdjustForm } from "./_components/stock-adjust-form";

export default async function UrunStokDetayPage({ params }: { params: { productId: string } }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  if (!getScope(session, "supplier", "view")) return <AccessDenied session={session} module="supplier" />;

  const product = await withTenant(session.companyId, (tx) => tx.product.findFirst({ where: { id: params.productId, deletedAt: null } }));
  if (!product) notFound();

  const stockResult = await getProductStock(session, params.productId);
  if (!stockResult.ok) return <p className="text-sm text-red-600">{stockResult.message}</p>;

  const canEdit = !!getScope(session, "supplier", "edit");
  const { stockQty, defaultCost, movements } = stockResult.data;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/app/satin-almalar/stok" className="text-xs text-brand-700 hover:underline">
        ← {tr.stock.title}
      </Link>
      <h1 className="mb-6 mt-1 text-xl font-semibold text-gray-800">{product.name}</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 rounded-2xl border border-gray-200 bg-white shadow-theme-xs p-4 text-sm">
        <div>
          <p className="text-gray-500">{tr.stock.current}</p>
          <p className={`text-lg font-semibold ${Number(stockQty) < 0 ? "text-red-600" : "text-gray-900"}`}>
            {stockQty} {product.unit}
          </p>
        </div>
        <div>
          <p className="text-gray-500">{tr.stock.cost}</p>
          <p className="text-xl font-semibold text-gray-800">{defaultCost != null ? formatCurrencyTRY(Number(defaultCost)) : "—"}</p>
        </div>
      </div>

      {canEdit && (
        <div className="mb-6">
          <StockAdjustForm productId={product.id} unit={product.unit} />
        </div>
      )}

      <h2 className="mb-2 text-sm font-semibold text-gray-900">{tr.stock.history}</h2>
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-theme-xs">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-theme-xs font-medium text-gray-500">
            <tr>
              <th className="px-4 py-3">Tarih</th>
              <th className="px-4 py-3">Tür</th>
              <th className="px-4 py-3 text-right">Miktar</th>
              <th className="px-4 py-3">Not</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {movements.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  {tr.stock.empty}
                </td>
              </tr>
            )}
            {movements.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3 text-gray-600">{formatDateTR(new Date(m.createdAt))}</td>
                <td className="px-4 py-3 text-gray-600">{tr.stock.type[m.type as keyof typeof tr.stock.type]}</td>
                <td className={`px-4 py-3 text-right font-medium ${Number(m.quantity) < 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {Number(m.quantity) > 0 ? "+" : ""}
                  {m.quantity}
                </td>
                <td className="px-4 py-3 text-gray-500">{m.note ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
