"use client";

/**
 * §5.9 Dashboard grafikleri — Tremor (@tremor/react, ücretsiz/MIT, Recharts üzerine kurulu).
 * Düzen kullanıcının paylaştığı referans panele göre kuruldu: alan grafiği + donut (merkezde
 * toplam, sağda lejant) + gradyan huni (dönüşüm oranı rozeti) + radyal tahsilat oranı +
 * müşteri çubuk listesi. Kategorik renk sırası sabittir (violet → fuchsia → indigo → sky →
 * emerald → amber → rose → slate); seri sayısı değişse de renk varlığı takip eder.
 */
import { AreaChart, BarList, DonutChart, ProgressCircle } from "@tremor/react";
import { formatCurrencyTRY } from "@/lib/i18n/tr";

const CATEGORY_COLORS = ["violet", "fuchsia", "indigo", "sky", "emerald", "amber", "rose", "slate"] as const;
const DOT_CLASS: Record<(typeof CATEGORY_COLORS)[number], string> = {
  violet: "bg-violet-500",
  fuchsia: "bg-fuchsia-500",
  indigo: "bg-indigo-500",
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  slate: "bg-slate-500",
};

export function compactCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".", ",")} Mn ₺`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)} B ₺`;
  return formatCurrencyTRY(value);
}

export function ChartCard({
  title,
  subtitle,
  action,
  children,
  empty,
  footer,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  empty?: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-theme-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-theme-xs text-gray-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="flex-1">
        {empty ? <p className="flex h-full min-h-[160px] items-center justify-center text-sm text-gray-400">{empty}</p> : children}
      </div>
      {footer && !empty && <div className="mt-4 border-t border-gray-100 pt-4">{footer}</div>}
    </div>
  );
}

export function MonthlyRevenueChart({
  data,
  labels,
}: {
  data: { label: string; revenue: number; collected: number }[];
  labels: { title: string; revenue: string; collected: string };
}) {
  const isEmpty = data.every((d) => d.revenue === 0 && d.collected === 0);
  const chartData = data.map((d) => ({ ay: d.label, [labels.revenue]: d.revenue, [labels.collected]: d.collected }));
  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalCollected = data.reduce((s, d) => s + d.collected, 0);
  return (
    <ChartCard
      title={labels.title}
      subtitle="Kesilen ciro ile kasaya giren tahsilatın aylık karşılaştırması"
      empty={isEmpty ? "Bu dönemde kayıt yok." : undefined}
      action={
        <div className="hidden gap-5 sm:flex">
          <Legend color="violet" label={labels.revenue} value={compactCurrency(totalRevenue)} />
          <Legend color="fuchsia" label={labels.collected} value={compactCurrency(totalCollected)} />
        </div>
      }
    >
      <AreaChart
        className="h-72"
        data={chartData}
        index="ay"
        categories={[labels.revenue, labels.collected]}
        colors={["violet", "fuchsia"]}
        valueFormatter={compactCurrency}
        showLegend={false}
        showGridLines
        yAxisWidth={64}
        showAnimation
        curveType="monotone"
      />
    </ChartCard>
  );
}

function Legend({ color, label, value }: { color: (typeof CATEGORY_COLORS)[number]; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-theme-xs text-gray-500">
        <span className={`h-2 w-2 rounded-full ${DOT_CLASS[color]}`} />
        {label}
      </div>
      <p className="mt-0.5 text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}

/** Referanstaki "Employee Distribution" donut'u: merkezde toplam, sağda yüzdeli lejant. */
export function ExpenseCategoryChart({
  data,
  title,
  emptyLabel,
}: {
  data: { categoryName: string; total: number }[];
  title: string;
  emptyLabel: string;
}) {
  // 7'den fazla kategori "Diğer"e katlanır — 9. seri için yeni renk üretilmez.
  const sorted = [...data].sort((a, b) => b.total - a.total);
  const head = sorted.slice(0, 7);
  const restTotal = sorted.slice(7).reduce((s, d) => s + d.total, 0);
  const slices = restTotal > 0 ? [...head, { categoryName: "Diğer", total: restTotal }] : head;
  const total = slices.reduce((s, d) => s + d.total, 0);
  const colors = CATEGORY_COLORS.slice(0, slices.length);

  return (
    <ChartCard title={title} empty={slices.length === 0 ? emptyLabel : undefined}>
      <div className="flex flex-col items-center gap-5">
        <div className="relative">
          <DonutChart
            className="h-48 w-48"
            data={slices}
            category="total"
            index="categoryName"
            colors={[...colors]}
            valueFormatter={compactCurrency}
            showLabel={false}
            showAnimation
          />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-theme-xs text-gray-500">Toplam</span>
            <span className="text-base font-bold text-gray-900">{compactCurrency(total)}</span>
          </div>
        </div>
        <ul className="w-full flex-1 space-y-2.5">
          {slices.map((s, i) => (
            <li key={s.categoryName} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-gray-600">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT_CLASS[colors[i]]}`} />
                <span className="truncate">{s.categoryName}</span>
              </span>
              <span className="shrink-0 font-semibold text-gray-900">
                {total > 0 ? `%${Math.round((s.total / total) * 100)}` : "—"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  );
}

/** Referanstaki "Recruitment Funnel": indigo→mor gradyan yatay çubuklar, değer çubuğun içinde. */
export function QuoteFunnelChart({ data, title }: { data: { stage: string; count: number }[]; title: string }) {
  const isEmpty = data.every((d) => d.count === 0);
  const max = Math.max(1, ...data.map((d) => d.count));
  const first = data[0]?.count ?? 0;
  const last = data[data.length - 1]?.count ?? 0;
  const conversion = first > 0 ? (last / first) * 100 : 0;
  return (
    <ChartCard
      title={title}
      empty={isEmpty ? "Henüz teklif yok." : undefined}
      footer={
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Teklif → sipariş dönüşümü</span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            %{conversion.toFixed(1).replace(".", ",")}
          </span>
        </div>
      }
    >
      <ul className="space-y-3">
        {data.map((d, i) => {
          const pct = Math.max(12, (d.count / max) * 100);
          return (
            <li key={d.stage} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm text-gray-600">{d.stage}</span>
              <div className="h-9 flex-1 rounded-lg bg-gray-50">
                <div
                  className="flex h-full items-center justify-end rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-3 text-sm font-semibold text-white transition-all"
                  style={{ width: `${pct}%`, opacity: 1 - i * 0.12 }}
                >
                  {d.count}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}

/** Referanstaki "Performance Score" radyali: tahsilat oranı = tahsilat / ciro. */
export function CollectionRateChart({
  revenue,
  collected,
  openReceivable,
  overdueReceivable,
}: {
  revenue: number;
  collected: number;
  openReceivable: number;
  overdueReceivable: number;
}) {
  const rate = revenue > 0 ? Math.min(100, (collected / revenue) * 100) : 0;
  const color = rate >= 75 ? "emerald" : rate >= 40 ? "violet" : "amber";
  return (
    <ChartCard
      title="Tahsilat Oranı"
      subtitle="Seçili dönemde kesilen cironun ne kadarı tahsil edildi"
      empty={revenue === 0 ? "Bu dönemde ciro yok." : undefined}
      footer={
        <div className="grid grid-cols-2 gap-3 text-center">
          <div>
            <p className="text-theme-xs text-gray-500">Açık alacak</p>
            <p className="text-sm font-semibold text-gray-900">{compactCurrency(openReceivable)}</p>
          </div>
          <div>
            <p className="text-theme-xs text-gray-500">Vadesi geçmiş</p>
            <p className={`text-sm font-semibold ${overdueReceivable > 0 ? "text-rose-600" : "text-gray-900"}`}>
              {compactCurrency(overdueReceivable)}
            </p>
          </div>
        </div>
      }
    >
      <div className="flex items-center justify-center py-2">
        <ProgressCircle value={rate} size="xl" color={color} strokeWidth={12} className="scale-125">
          <div className="text-center">
            <p className="text-xl font-bold text-gray-900">%{Math.round(rate)}</p>
            <p className="text-[11px] text-gray-500">tahsil</p>
          </div>
        </ProgressCircle>
      </div>
    </ChartCard>
  );
}

export function TopCustomersChart({
  data,
  title,
  emptyLabel,
}: {
  data: { customerTitle: string; revenue: number }[];
  title: string;
  emptyLabel: string;
}) {
  return (
    <ChartCard title={title} empty={data.length === 0 ? emptyLabel : undefined}>
      <div className="mb-2 flex justify-between text-theme-xs font-medium uppercase tracking-wide text-gray-400">
        <span>Müşteri</span>
        <span>Ciro</span>
      </div>
      <BarList
        data={data.map((d) => ({ name: d.customerTitle, value: d.revenue }))}
        valueFormatter={compactCurrency}
        color="violet"
        showAnimation
      />
    </ChartCard>
  );
}
