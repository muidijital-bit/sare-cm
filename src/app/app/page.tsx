import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ComponentType } from "react";
import {
  TrendingUp,
  DollarSign,
  CreditCard,
  AlertTriangle,
  TrendingDown,
  BarChart2,
  PieChart,
  FileText,
  ShoppingBag,
  UserPlus,
  Package,
  ArrowUpRight,
  ArrowDownRight,
} from "react-feather";
import { getTenantSession } from "@/lib/auth/session";
import { getScope } from "@/lib/auth/access";
import { getDashboardCharts, getDashboardMetrics } from "@/lib/modules/dashboard/service";
import { getUpcomingObligations } from "@/lib/modules/tax-obligations/service";
import { tr, formatCurrencyTRY, formatDateTR } from "@/lib/i18n/tr";
import { DashboardPeriodPicker } from "./_components/dashboard-period-picker";
import { OnboardingChecklist } from "./_components/onboarding-checklist";
import { getOnboarding } from "@/lib/modules/onboarding/service";
import {
  CollectionRateChart,
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

export const metadata: Metadata = { title: "Panel" };

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
  const [metrics, charts, upcomingObligations, onboarding] = await Promise.all([
    getDashboardMetrics(session, from, to),
    getDashboardCharts(session),
    canViewTax ? getUpcomingObligations(session, 5) : Promise.resolve(null),
    getOnboarding(session),
  ]);

  // Trend rozetleri: son 12 ay serisinden bu ay vs geçen ay (yalnız ciro/tahsilat için veri var;
  // diğer kartlara uydurma trend konmaz).
  const months = charts.monthlyRevenueVsCollected;
  const thisMonth = months[months.length - 1];
  const prevMonth = months[months.length - 2];
  const trend = (cur?: number, prev?: number) =>
    cur == null || prev == null || prev === 0 ? null : ((cur - prev) / prev) * 100;
  const revenueTrend = trend(thisMonth?.revenue, prevMonth?.revenue);
  const collectedTrend = trend(thisMonth?.collected, prevMonth?.collected);

  const firstName = session.userName.split(" ")[0];

  const quickActions = [
    { href: "/app/musteriler/yeni", label: "Yeni Müşteri", icon: UserPlus, tone: "bg-violet-50 text-violet-600", module: "customer" },
    { href: "/app/teklifler/yeni", label: "Yeni Teklif", icon: FileText, tone: "bg-sky-50 text-sky-600", module: "quote" },
    { href: "/app/siparisler/yeni", label: "Yeni Sipariş", icon: ShoppingBag, tone: "bg-fuchsia-50 text-fuchsia-600", module: "order" },
    { href: "/app/tahsilatlar/yeni", label: "Tahsilat Gir", icon: DollarSign, tone: "bg-emerald-50 text-emerald-600", module: "payment" },
    { href: "/app/giderler/yeni", label: "Gider Gir", icon: TrendingDown, tone: "bg-rose-50 text-rose-600", module: "expense" },
    { href: "/app/satin-almalar/yeni", label: "Satın Alma", icon: Package, tone: "bg-amber-50 text-amber-600", module: "supplier" },
  ] as const;
  const visibleActions = quickActions.filter(
    (a) => session.enabledModules.includes("*") || session.enabledModules.includes(a.module) ? !!getScope(session, a.module, "create") : false,
  );

  return (
    <div className="space-y-6">
      {/* Karşılama başlığı */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Tekrar hoş geldin, {firstName}</h1>
          <p className="mt-1 text-sm text-gray-500">{session.companyName} için bugün olan bitenin özeti.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DashboardPeriodPicker
            defaultFrom={toDateInput(defaultFrom)}
            defaultTo={toDateInput(defaultTo)}
            activeFrom={toDateInput(from)}
            activeTo={toDateInput(to)}
          />
        </div>
      </div>

      {session.companyStatus === "SUSPENDED" && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {tr.company.suspendedBanner}
        </div>
      )}

      {onboarding && onboarding.steps.length > 0 && <OnboardingChecklist data={onboarding} />}

      {metrics.scopedToOwn && <p className="text-xs text-gray-400">Bu rakamlar yalnızca size ait kayıtları içerir.</p>}

      {/* Ana KPI kartları */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={tr.dashboard.revenue} value={formatCurrencyTRY(metrics.revenue)} icon={TrendingUp} tone="violet" trend={revenueTrend} />
        <KpiCard label={tr.dashboard.collected} value={formatCurrencyTRY(metrics.collected)} icon={DollarSign} tone="emerald" trend={collectedTrend} />
        <KpiCard label={tr.dashboard.openReceivable} value={formatCurrencyTRY(metrics.openReceivable)} icon={CreditCard} tone="sky" />
        <KpiCard
          label={tr.dashboard.overdueReceivable}
          value={formatCurrencyTRY(metrics.overdueReceivable)}
          icon={AlertTriangle}
          tone="rose"
          hint={metrics.overdueReceivable > 0 ? "Takip gerekiyor" : "Gecikme yok"}
          hintTone={metrics.overdueReceivable > 0 ? "bad" : "good"}
          href={getScope(session, "payment", "view") ? "/app/tahsilatlar" : undefined}
        />
      </div>

      {/* İkincil metrikler */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {metrics.canViewExpense && (
          <MiniStat label={tr.dashboard.expense} value={formatCurrencyTRY(metrics.expense ?? 0)} icon={TrendingDown} tone="rose" />
        )}
        <MiniStat
          label={tr.dashboard.grossProfit}
          value={metrics.grossProfit != null ? formatCurrencyTRY(metrics.grossProfit) : "—"}
          note={metrics.hasMissingCostData ? "maliyeti eksik satır var" : undefined}
          icon={BarChart2}
          tone="violet"
        />
        {metrics.canViewExpense && (
          <MiniStat
            label={tr.dashboard.netProfit}
            value={metrics.netProfit != null ? formatCurrencyTRY(metrics.netProfit) : "—"}
            icon={PieChart}
            tone="indigo"
          />
        )}
        <MiniStat
          label={tr.dashboard.pendingQuotes}
          value={String(metrics.pendingQuotesCount)}
          note={formatCurrencyTRY(metrics.pendingQuotesTotal)}
          icon={FileText}
          tone="amber"
          href={getScope(session, "quote", "view") ? "/app/teklifler?status=SENT" : undefined}
        />
        <MiniStat
          label={tr.dashboard.activeOrders}
          value={String(metrics.activeOrdersCount)}
          icon={ShoppingBag}
          tone="sky"
          href={getScope(session, "order", "view") ? "/app/siparisler" : undefined}
        />
      </div>

      {/* Ciro/tahsilat trendi + gider dağılımı */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
        {charts.canViewExpense ? (
          <ExpenseCategoryChart
            data={charts.expenseByCategory}
            title={tr.dashboard.charts.expenseTitle}
            emptyLabel={tr.dashboard.charts.expenseEmpty}
          />
        ) : (
          <CollectionRateChart
            revenue={metrics.revenue}
            collected={metrics.collected}
            openReceivable={metrics.openReceivable}
            overdueReceivable={metrics.overdueReceivable}
          />
        )}
      </div>

      {/* Huni + tahsilat oranı + hızlı işlemler */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <QuoteFunnelChart data={charts.quoteFunnel} title={tr.dashboard.charts.funnelTitle} />
        {charts.canViewExpense && (
          <CollectionRateChart
            revenue={metrics.revenue}
            collected={metrics.collected}
            openReceivable={metrics.openReceivable}
            overdueReceivable={metrics.overdueReceivable}
          />
        )}
        {visibleActions.length > 0 && (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-theme-sm">
            <h3 className="mb-4 text-[15px] font-semibold text-gray-900">Hızlı İşlemler</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
              {visibleActions.map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="group flex flex-col items-center gap-2 rounded-xl border border-gray-100 p-3 text-center transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-theme-md"
                >
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${a.tone}`}>
                    <a.icon size={18} />
                  </span>
                  <span className="text-xs font-medium text-gray-700 group-hover:text-violet-700">{a.label}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* En iyi müşteriler + yaklaşan yükümlülükler */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopCustomersChart
          data={charts.topCustomers}
          title={tr.dashboard.charts.topCustomersTitle}
          emptyLabel={tr.dashboard.charts.topCustomersEmpty}
        />
        {canViewTax && upcomingObligations?.ok && (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-theme-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-gray-900">{tr.taxObligation.upcomingTitle}</h3>
              <Link href="/app/vergi-sgk" className="text-xs font-medium text-violet-600 hover:underline">
                Tümü →
              </Link>
            </div>
            {upcomingObligations.data.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">{tr.taxObligation.upcomingEmpty}</p>
            ) : (
              <ul className="space-y-2">
                {upcomingObligations.data.map((o) => {
                  const overdue = new Date(o.dueDate) < now;
                  return (
                    <li key={o.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 text-sm">
                      <span className="flex items-center gap-2.5">
                        <span className={`h-2 w-2 rounded-full ${overdue ? "bg-rose-500" : "bg-violet-500"}`} />
                        <span className="font-medium text-gray-800">
                          {tr.taxObligation.type[o.type as keyof typeof tr.taxObligation.type]}
                        </span>
                        <span className="text-gray-400">{o.period}</span>
                      </span>
                      <span className="text-right">
                        <span className="block font-semibold text-gray-900">{formatCurrencyTRY(Number(o.amount))}</span>
                        <span className={`text-xs ${overdue ? "font-medium text-rose-600" : "text-gray-500"}`}>
                          {formatDateTR(new Date(o.dueDate))}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type Tone = "violet" | "emerald" | "sky" | "rose" | "amber" | "indigo";
const TONE_CHIP: Record<Tone, string> = {
  violet: "bg-violet-100 text-violet-600",
  emerald: "bg-emerald-100 text-emerald-600",
  sky: "bg-sky-100 text-sky-600",
  rose: "bg-rose-100 text-rose-600",
  amber: "bg-amber-100 text-amber-600",
  indigo: "bg-indigo-100 text-indigo-600",
};
type IconType = ComponentType<{ size?: number | string; className?: string }>;

/** Referans paneldeki KPI kartı: küçük etiket, büyük rakam, sağ üstte pastel ikon, altta trend rozeti. */
function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
  trend,
  hint,
  hintTone,
  href,
}: {
  label: string;
  value: string;
  icon: IconType;
  tone: Tone;
  trend?: number | null;
  hint?: string;
  hintTone?: "good" | "bad";
  href?: string;
}) {
  const body = (
    <div className="h-full rounded-2xl border border-gray-100 bg-white p-5 shadow-theme-sm transition hover:shadow-theme-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONE_CHIP[tone]}`}>
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-2 text-[26px] font-bold leading-tight tracking-tight text-gray-900">{value}</p>
      <div className="mt-3 flex items-center gap-2 text-xs">
        {trend != null ? (
          <>
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold ${
                trend >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {Math.abs(trend) > 999 ? "%999+" : `%${Math.abs(trend).toFixed(0)}`}
            </span>
            <span className="text-gray-400">geçen aya göre</span>
          </>
        ) : hint ? (
          <span
            className={`rounded-full px-2 py-0.5 font-semibold ${
              hintTone === "bad" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {hint}
          </span>
        ) : (
          <span className="text-gray-400">Seçili dönem</span>
        )}
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function MiniStat({
  label,
  value,
  note,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value: string;
  note?: string;
  icon: IconType;
  tone: Tone;
  href?: string;
}) {
  const body = (
    <div className="flex h-full items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-theme-xs transition hover:shadow-theme-sm">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONE_CHIP[tone]}`}>
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-gray-500">{label}</p>
        <p className="truncate text-base font-bold text-gray-900">{value}</p>
        {note && <p className="truncate text-[11px] text-gray-400">{note}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
