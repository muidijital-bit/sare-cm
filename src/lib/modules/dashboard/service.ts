import { withTenant } from "@/lib/db/tenant-context";
import { getRequiredScope } from "@/lib/auth/rbac";
import type { TenantSession } from "@/lib/auth/session";
import { listOverdueReceivables } from "@/lib/modules/payments/service";

export interface DashboardMetrics {
  revenue: number; // Ciro (KDV hariç, dönem, iptal olmayan siparişler — §7)
  collected: number; // Tahsilat (dönem, iptal olmayan ödemeler)
  openReceivable: number; // Açık alacak (tüm zamanlar, KDV dahil siparişler - toplam tahsilat)
  overdueReceivable: number; // Vadesi geçmiş alacak
  cogs: number | null; // Satılan malın maliyeti — bir satırda unit_cost girilmemişse null
  grossProfit: number | null; // Brüt kâr
  expense: number | null; // Gider (yetkisi yoksa null — kart hiç gösterilmez)
  netProfit: number | null; // Net kâr
  pendingQuotesCount: number;
  pendingQuotesTotal: number;
  activeOrdersCount: number;
  scopedToOwn: boolean; // §5.9 "Satış rolü yalnız kendi rakamlarını görür"
  canViewExpense: boolean;
  hasMissingCostData: boolean;
}

/**
 * §7 Metrik Tanımları — dashboard rakamlarının TEK kaynağı burasıdır. Başka bir ekran
 * aynı rakamı göstermek isterse bu fonksiyonu çağırır, formülü yeniden yazmaz.
 */
export async function getDashboardMetrics(session: TenantSession, from: Date, to: Date): Promise<DashboardMetrics> {
  const orderScope = getRequiredScope(session.role, "order", "view");
  const quoteScope = getRequiredScope(session.role, "quote", "view");
  const expenseScope = getRequiredScope(session.role, "expense", "view");
  const scopedToOwn = orderScope === "own" || quoteScope === "own";

  return withTenant(session.companyId, async (tx) => {
    // --- Ciro + Satılan Malın Maliyeti + Brüt Kâr (dönem) ---
    const periodOrders = await tx.order.findMany({
      where: {
        orderDate: { gte: from, lte: to },
        status: { not: "CANCELLED" },
        deletedAt: null,
        ...(orderScope === "own" ? { ownerUserId: session.userId } : {}),
      },
      include: { items: { select: { unitCost: true, quantity: true } } },
    });

    let revenue = 0;
    let cogs = 0;
    let hasMissingCostData = false;
    for (const order of periodOrders) {
      revenue += Number(order.grandTotal) - Number(order.vatTotal); // KDV hariç net
      if (order.items.length === 0) continue;
      for (const item of order.items) {
        if (item.unitCost == null) {
          hasMissingCostData = true;
          continue;
        }
        cogs += Number(item.unitCost) * Number(item.quantity);
      }
    }
    const grossProfit = hasMissingCostData ? null : revenue - cogs;

    // --- Tahsilat (dönem) — payment görünürlüğü rol matrisinde her zaman "all" ---
    const periodPaymentsAgg = await tx.payment.aggregate({
      where: { paidAt: { gte: from, lte: to }, isCancelled: false },
      _sum: { amount: true },
    });
    const collected = Number(periodPaymentsAgg._sum.amount ?? 0);

    // --- Açık alacak (tüm zamanlar, KDV dahil) ---
    const allOrdersAgg = await tx.order.aggregate({
      where: { status: { not: "CANCELLED" }, deletedAt: null },
      _sum: { grandTotal: true },
    });
    const allPaymentsAgg = await tx.payment.aggregate({ where: { isCancelled: false }, _sum: { amount: true } });
    const openReceivable = Number(allOrdersAgg._sum.grandTotal ?? 0) - Number(allPaymentsAgg._sum.amount ?? 0);

    // --- Vadesi geçmiş alacak — TH-07 ile aynı hesap, tek kaynak ---
    const overdueResult = await listOverdueReceivables(session);
    const overdueReceivable = overdueResult.ok ? overdueResult.data.reduce((sum, r) => sum + r.amount, 0) : 0;

    // --- Gider (dönem) — yalnız yetkisi olan roller için hesaplanır ---
    let expense: number | null = null;
    if (expenseScope) {
      const periodExpenseAgg = await tx.expense.aggregate({
        where: { spentAt: { gte: from, lte: to }, isRecurringTemplate: false, deletedAt: null },
        _sum: { amount: true },
      });
      expense = Number(periodExpenseAgg._sum.amount ?? 0);
    }
    const netProfit = grossProfit != null && expense != null ? grossProfit - expense : null;

    // --- Bekleyen teklifler ---
    const pendingQuotesAgg = await tx.quote.aggregate({
      where: { status: "SENT", deletedAt: null, ...(quoteScope === "own" ? { ownerUserId: session.userId } : {}) },
      _sum: { grandTotal: true },
      _count: true,
    });

    // --- Aktif siparişler ---
    const activeOrdersCount = await tx.order.count({
      where: {
        status: { in: ["CONFIRMED", "PREPARING", "DELIVERED"] },
        deletedAt: null,
        ...(orderScope === "own" ? { ownerUserId: session.userId } : {}),
      },
    });

    return {
      revenue,
      collected,
      openReceivable,
      overdueReceivable,
      cogs: hasMissingCostData ? null : cogs,
      grossProfit,
      expense,
      netProfit,
      pendingQuotesCount: pendingQuotesAgg._count,
      pendingQuotesTotal: Number(pendingQuotesAgg._sum.grandTotal ?? 0),
      activeOrdersCount,
      scopedToOwn,
      canViewExpense: !!expenseScope,
      hasMissingCostData,
    };
  });
}
