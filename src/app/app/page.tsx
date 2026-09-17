import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { getDashboardCharts, getDashboardMetrics } from "@/lib/modules/dashboard/service";
import { tr, formatCurrencyTRY } from "@/lib/i18n/tr";
import { DashboardPeriodPicker } from "./_components/dashboard-period-picker";
import {
  ExpenseCategoryChart,
  MonthlyRevenueChart,
  QuoteFunnelChart,
  TopCustomersChart,
} from "./_components/dashboard-charts";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
const toDateInput = (d: Date) => d.toISOString().slice(0, 10);

export default async function DashboardPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const session = await getTenantSession();
  if (!session) {
    redirect("/app/sirket-sec");
  }

  const now = new Date();
  const defaultFrom = startOfMonth(now);
  const defaultTo = endOfMonth(now);
  const from = searchParams.from ? new Date(searchParams.from) : defaultFrom;
  const to = searchParams.to ? new Date(`${searchParams.to}T23:59:59`) : defaultTo;

  const [metrics, charts] = await Promise.all([
    getDashboardMetrics(session, from, to),
    getDashboardCharts(session),
  ]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-gray-900">{tr.dashboard.title}</h1>
        <DashboardPeriodPicker defaultFrom={toDateInput(defaultFrom)} defaultTo={toDateInput(defaultTo)} />
      </div>

      {session.companyStatus === "SUSPENDED" && (
        <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {tr.company.suspendedBanner}
        </div>
      )}

      {metrics.scopedToOwn && (
        <p className="mb-4 text-xs text-gray-400">Bu rakamlar yalnızca size ait kayıtları içerir.</p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card label={tr.dashboard.revenue} value={formatCurrencyTRY(metrics.revenue)} />
        <Card label={tr.dashboard.collected} value={formatCurrencyTRY(metrics.collected)} />
        <Card label={tr.dashboard.openReceivable} value={formatCurrencyTRY(metrics.openReceivable)} />
        <Card label={tr.dashboard.overdueReceivable} value={formatCurrencyTRY(metrics.overdueReceivable)} warn={metrics.overdueReceivable > 0} />
        {metrics.canViewExpense && <Card label={tr.dashboard.expense} value={formatCurrencyTRY(metrics.expense ?? 0)} />}
        <Card
          label={tr.dashboard.grossProfit}
          value={metrics.grossProfit != null ? formatCurrencyTRY(metrics.grossProfit) : "—"}
          note={metrics.hasMissingCostData ? "eksik veri (maliyet girilmemiş satır var)" : undefined}
        />
        {metrics.canViewExpense && (
          <Card label={tr.dashboard.netProfit} value={metrics.netProfit != null ? formatCurrencyTRY(metrics.netProfit) : "—"} />
        )}
        <Card
          label={tr.dashboard.pendingQuotes}
          value={`${metrics.pendingQuotesCount} · ${formatCurrencyTRY(metrics.pendingQuotesTotal)}`}
        />
        <Card label={tr.dashboard.activeOrders} value={String(metrics.activeOrdersCount)} />
      </div>

      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        <Link href="/app/teklifler?status=SENT" className="text-gray-600 hover:underline">
          Bekleyen teklifleri gör →
        </Link>
        <Link href="/app/siparisler" className="text-gray-600 hover:underline">
          Siparişleri gör →
        </Link>
        <Link href="/app/tahsilatlar" className="text-gray-600 hover:underline">
          Vadesi geçmiş alacakları gör →
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <MonthlyRevenueChart
            data={charts.monthlyRevenueVsCollected}
            labels={{
              title: tr.dashboard.charts.monthlyTitle,
              revenue: tr.dashboard.charts.monthlyRevenue,
              collected: tr.dashboard.charts.monthlyCollected,
            }}
          />
        </div>
        <QuoteFunnelChart data={charts.quoteFunnel} title={tr.dashboard.charts.funnelTitle} />
        {charts.canViewExpense && (
          <ExpenseCategoryChart
            data={charts.expenseByCategory}
            title={tr.dashboard.charts.expenseTitle}
            emptyLabel={tr.dashboard.charts.expenseEmpty}
          />
        )}
        <div className={charts.canViewExpense ? "lg:col-span-2" : ""}>
          <TopCustomersChart
            data={charts.topCustomers}
            title={tr.dashboard.charts.topCustomersTitle}
            emptyLabel={tr.dashboard.charts.topCustomersEmpty}
          />
        </div>
      </div>
    </div>
  );
}

function Card({ label, value, note, warn }: { label: string; value: string; note?: string; warn?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${warn ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${warn ? "text-red-700" : "text-gray-900"}`}>{value}</p>
      {note && <p className="mt-1 text-xs text-amber-600">{note}</p>}
    </div>
  );
}
