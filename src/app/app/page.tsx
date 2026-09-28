import Link from "next/link";
import { redirect } from "next/navigation";
import type { ComponentType } from "react";
import { TrendingUp, DollarSign, CreditCard, AlertTriangle, TrendingDown, BarChart2, PieChart, FileText, ShoppingBag } from "react-feather";
import { getTenantSession } from "@/lib/auth/session";
import { getScope } from "@/lib/auth/access";
import { getDashboardCharts, getDashboardMetrics } from "@/lib/modules/dashboard/service";
import { getUpcomingObligations } from "@/lib/modules/tax-obligations/service";
import { tr, formatCurrencyTRY, formatDateTR } from "@/lib/i18n/tr";
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

/**
 * `<input type="date">` için YYYY-MM-DD. `toISOString()` KULLANILMAZ: o UTC'ye çevirir ve
 * UTC+3'te yerel gece yarısı bir önceki güne kayıyordu (ay başı 01 yerine 31 görünüyor,
 * filtre bir gün şaşıyordu). Yerel takvim alanlarıyla kuruluyor.
 */
function toDateInput(d: Date) {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** "YYYY-MM-DD" → YEREL gün başlangıcı/sonu. `new Date("YYYY-MM-DD")` UTC yorumlar; karışmasın. */
function parseDateInput(value: string, endOfDay: boolean): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  return endOfDay
    ? new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 59, 999)
    : new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0);
}

export default async function DashboardPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const session = await getTenantSession();
  if (!session) {
    redirect("/app/sirket-sec");
  }

  const now = new Date();
  const defaultFrom = startOfMonth(now);
  const defaultTo = endOfMonth(now);
  const from = (searchParams.from && parseDateInput(searchParams.from, false)) || defaultFrom;
  const to = (searchParams.to && parseDateInput(searchParams.to, true)) || defaultTo;

  const canViewTax = !!getScope(session, "taxObligation", "view");
  const [metrics, charts, upcomingObligations] = await Promise.all([
    getDashboardMetrics(session, from, to),
    getDashboardCharts(session),
    canViewTax ? getUpcomingObligations(session, 5) : Promise.resolve(null),
  ]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-end gap-3">
        <DashboardPeriodPicker
          defaultFrom={toDateInput(defaultFrom)}
          defaultTo={toDateInput(defaultTo)}
          activeFrom={toDateInput(from)}
          activeTo={toDateInput(to)}
        />
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
        <Card label={tr.dashboard.revenue} value={formatCurrencyTRY(metrics.revenue)} icon={TrendingUp} color="blue" />
        <Card label={tr.dashboard.collected} value={formatCurrencyTRY(metrics.collected)} icon={DollarSign} color="emerald" />
        <Card label={tr.dashboard.openReceivable} value={formatCurrencyTRY(metrics.openReceivable)} icon={CreditCard} color="amber" />
        <Card
          label={tr.dashboard.overdueReceivable}
          value={formatCurrencyTRY(metrics.overdueReceivable)}
          icon={AlertTriangle}
          color="red"
          warn={metrics.overdueReceivable > 0}
        />
        {metrics.canViewExpense && (
          <Card label={tr.dashboard.expense} value={formatCurrencyTRY(metrics.expense ?? 0)} icon={TrendingDown} color="rose" />
        )}
        <Card
          label={tr.dashboard.grossProfit}
          value={metrics.grossProfit != null ? formatCurrencyTRY(metrics.grossProfit) : "—"}
          note={metrics.hasMissingCostData ? "eksik veri (maliyet girilmemiş satır var)" : undefined}
          icon={BarChart2}
          color="violet"
        />
        {metrics.canViewExpense && (
          <Card
            label={tr.dashboard.netProfit}
            value={metrics.netProfit != null ? formatCurrencyTRY(metrics.netProfit) : "—"}
            icon={PieChart}
            color="indigo"
          />
        )}
        <Card
          label={tr.dashboard.pendingQuotes}
          value={`${metrics.pendingQuotesCount} · ${formatCurrencyTRY(metrics.pendingQuotesTotal)}`}
          icon={FileText}
          color="amber"
        />
        <Card label={tr.dashboard.activeOrders} value={String(metrics.activeOrdersCount)} icon={ShoppingBag} color="cyan" />
      </div>

      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        {getScope(session, "quote", "view") && (
          <Link href="/app/teklifler?status=SENT" className="text-gray-600 hover:underline">
            Bekleyen teklifleri gör →
          </Link>
        )}
        {getScope(session, "order", "view") && (
          <Link href="/app/siparisler" className="text-gray-600 hover:underline">
            Siparişleri gör →
          </Link>
        )}
        {getScope(session, "payment", "view") && (
          <Link href="/app/tahsilatlar" className="text-gray-600 hover:underline">
            Vadesi geçmiş alacakları gör →
          </Link>
        )}
      </div>

      {canViewTax && upcomingObligations?.ok && (
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">{tr.taxObligation.upcomingTitle}</h2>
            <Link href="/app/vergi-sgk" className="text-xs text-brand-700 hover:underline">
              {tr.taxObligation.title} →
            </Link>
          </div>
          {upcomingObligations.data.length === 0 ? (
            <p className="text-sm text-gray-400">{tr.taxObligation.upcomingEmpty}</p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {upcomingObligations.data.map((o) => {
                const overdue = new Date(o.dueDate) < now;
                return (
                  <li key={o.id} className="flex items-center justify-between py-2">
                    <span className="text-gray-700">
                      {tr.taxObligation.type[o.type as keyof typeof tr.taxObligation.type]} · {o.period}
                    </span>
                    <span className={overdue ? "font-medium text-red-600" : "text-gray-600"}>
                      {formatDateTR(new Date(o.dueDate))} · {formatCurrencyTRY(Number(o.amount))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

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

type CardColor = "blue" | "emerald" | "amber" | "red" | "rose" | "violet" | "indigo" | "cyan";

/** Tailwind JIT tarama için tam sınıf adları literal olarak burada durmalı (template literal ile üretilemez). */
const CARD_COLOR_CHIP: Record<CardColor, string> = {
  blue: "bg-blue-100 text-blue-600",
  emerald: "bg-emerald-100 text-emerald-600",
  amber: "bg-amber-100 text-amber-600",
  red: "bg-red-100 text-red-600",
  rose: "bg-rose-100 text-rose-600",
  violet: "bg-violet-100 text-violet-600",
  indigo: "bg-indigo-100 text-indigo-600",
  cyan: "bg-cyan-100 text-cyan-600",
};

function Card({
  label,
  value,
  note,
  warn,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  note?: string;
  warn?: boolean;
  icon: ComponentType<{ size?: number | string; className?: string }>;
  color: CardColor;
}) {
  return (
    <div className={`rounded-lg border p-4 ${warn ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-gray-500">{label}</p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${CARD_COLOR_CHIP[color]}`}>
          <Icon size={16} />
        </span>
      </div>
      <p className={`mt-2 text-xl font-semibold ${warn ? "text-red-700" : "text-gray-900"}`}>{value}</p>
      {note && <p className="mt-1 text-xs text-amber-600">{note}</p>}
    </div>
  );
}
