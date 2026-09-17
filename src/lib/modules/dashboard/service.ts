import dayjs from "dayjs";
import { withTenant } from "@/lib/db/tenant-context";
import { getRequiredScope } from "@/lib/auth/rbac";
import type { TenantSession } from "@/lib/auth/session";
import { listOverdueReceivables } from "@/lib/modules/payments/service";
import { getCategoryReport } from "@/lib/modules/expenses/service";

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

export interface DashboardCharts {
  monthlyRevenueVsCollected: { month: string; label: string; revenue: number; collected: number }[];
  expenseByCategory: { categoryName: string; total: number }[];
  quoteFunnel: { stage: string; count: number }[];
  topCustomers: { customerTitle: string; revenue: number }[];
  canViewExpense: boolean;
}

/**
 * §5.9 Dashboard grafikleri — 4 grafiğin tamamı TEK transaction/round-trip içinde
 * hesaplanır (performans: bkz. src/lib/db/tenant-context.ts notu — Neon'a her ayrı
 * withTenant() çağrısı ~750-800ms'lik bir round-trip demek; 4 ayrı çağrı yerine 1
 * kullanmak sayfa açılışında ölçülebilir kazanç sağlar). Gider kırılımı, kendi
 * withTenant'ı olan getCategoryReport()'u (GD-02 ile aynı tek kaynak) ayrıca çağırır.
 */
export async function getDashboardCharts(session: TenantSession): Promise<DashboardCharts> {
  const orderScope = getRequiredScope(session.role, "order", "view");
  const quoteScope = getRequiredScope(session.role, "quote", "view");
  const expenseScope = getRequiredScope(session.role, "expense", "view");

  const twelveMonthsAgo = dayjs().subtract(11, "month").startOf("month").toDate();

  const combined = await withTenant(session.companyId, async (tx) => {
    // --- 1) Aylık ciro / tahsilat (son 12 ay) ---
    const [periodOrders, periodPayments] = await Promise.all([
      tx.order.findMany({
        where: {
          orderDate: { gte: twelveMonthsAgo },
          status: { not: "CANCELLED" },
          deletedAt: null,
          ...(orderScope === "own" ? { ownerUserId: session.userId } : {}),
        },
        select: { orderDate: true, grandTotal: true, vatTotal: true },
      }),
      tx.payment.findMany({
        where: { paidAt: { gte: twelveMonthsAgo }, isCancelled: false },
        select: { paidAt: true, amount: true },
      }),
    ]);

    const months: { month: string; label: string; revenue: number; collected: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = dayjs().subtract(i, "month");
      months.push({ month: d.format("YYYY-MM"), label: d.format("MMM YY"), revenue: 0, collected: 0 });
    }
    const byMonth = new Map(months.map((m) => [m.month, m]));
    for (const o of periodOrders) {
      const key = dayjs(o.orderDate).format("YYYY-MM");
      const bucket = byMonth.get(key);
      if (bucket) bucket.revenue += Number(o.grandTotal) - Number(o.vatTotal);
    }
    for (const p of periodPayments) {
      const key = dayjs(p.paidAt).format("YYYY-MM");
      const bucket = byMonth.get(key);
      if (bucket) bucket.collected += Number(p.amount);
    }

    // --- 2) Teklif durum hunisi (tüm zamanlar) ---
    const quotes = await tx.quote.findMany({
      where: { deletedAt: null, ...(quoteScope === "own" ? { ownerUserId: session.userId } : {}) },
      select: { status: true, orders: { select: { id: true }, take: 1 } },
    });
    const sentCount = quotes.filter((q) => q.status !== "DRAFT").length;
    const acceptedCount = quotes.filter((q) => q.status === "ACCEPTED").length;
    const convertedCount = quotes.filter((q) => q.status === "ACCEPTED" && q.orders.length > 0).length;

    // --- 3) En yüksek cirolu 10 müşteri (son 12 ay) ---
    const topOrders = await tx.order.findMany({
      where: {
        orderDate: { gte: twelveMonthsAgo },
        status: { not: "CANCELLED" },
        deletedAt: null,
        ...(orderScope === "own" ? { ownerUserId: session.userId } : {}),
      },
      select: { grandTotal: true, vatTotal: true, customer: { select: { title: true } } },
    });
    const byCustomer = new Map<string, number>();
    for (const o of topOrders) {
      const net = Number(o.grandTotal) - Number(o.vatTotal);
      byCustomer.set(o.customer.title, (byCustomer.get(o.customer.title) ?? 0) + net);
    }
    const topCustomers = Array.from(byCustomer.entries())
      .map(([customerTitle, revenue]) => ({ customerTitle, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      monthlyRevenueVsCollected: months,
      quoteFunnel: [
        { stage: "Gönderildi", count: sentCount },
        { stage: "Kabul Edildi", count: acceptedCount },
        { stage: "Siparişe Dönüştü", count: convertedCount },
      ],
      topCustomers,
    };
  });

  let expenseByCategory: { categoryName: string; total: number }[] = [];
  if (expenseScope) {
    const report = await getCategoryReport(session, twelveMonthsAgo, new Date());
    if (report.ok) {
      expenseByCategory = report.data.map((r) => ({ categoryName: r.categoryName, total: r.total }));
    }
  }

  return { ...combined, expenseByCategory, canViewExpense: !!expenseScope };
}
