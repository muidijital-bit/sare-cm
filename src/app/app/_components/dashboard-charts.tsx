"use client";

/**
 * §5.9 Dashboard grafikleri — dataviz kılavuzuna göre: renk atama işi/rolüne göre yapılır
 * (kategorik = kimlik, sıralı-tek-renk = büyüklük), ince çizgiler/çubuklar, >=2 seri için
 * daima lejant, seçici doğrudan etiketler, tooltip ile etkileşim. Renkler
 * `references/palette.md`'den doğrulanmış değerler (kategorik slot 1/2 ve sıralı mavi rampa).
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrencyTRY } from "@/lib/i18n/tr";

const COLOR_SERIES_1 = "#2a78d6"; // kategorik slot 1 (mavi) — Ciro
const COLOR_SERIES_2 = "#eb6834"; // kategorik slot 2 (turuncu) — Tahsilat
const COLOR_SEQ_BASE = "#2a78d6"; // sıralı mavi rampa, tek-seri büyüklük çubukları
const COLOR_FUNNEL = ["#86b6ef", "#2a78d6", "#104281"]; // sıralı mavi rampa, adım 250/450/650 — huni sırası
const AXIS_TICK = { fill: "#6b7280", fontSize: 12 };
const GRID_STROKE = "#e5e7eb";

function compactCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} Mn ₺`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)} bin ₺`;
  return formatCurrencyTRY(value);
}

function ChartCard({ title, children, empty }: { title: string; children: React.ReactNode; empty?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="mb-3 text-sm font-semibold text-gray-900">{title}</p>
      {empty ? <p className="py-10 text-center text-xs text-gray-400">{empty}</p> : children}
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
  return (
    <ChartCard title={labels.title} empty={isEmpty ? "Bu dönemde kayıt yok." : undefined}>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={{ stroke: GRID_STROKE }} tickLine={false} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={compactCurrency} width={72} />
          <Tooltip formatter={(value: number) => formatCurrencyTRY(value)} contentStyle={{ fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="revenue" name={labels.revenue} stroke={COLOR_SERIES_1} strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="collected" name={labels.collected} stroke={COLOR_SERIES_2} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function ExpenseCategoryChart({
  data,
  title,
  emptyLabel,
}: {
  data: { categoryName: string; total: number }[];
  title: string;
  emptyLabel: string;
}) {
  const top = data.slice(0, 8);
  return (
    <ChartCard title={title} empty={top.length === 0 ? emptyLabel : undefined}>
      <ResponsiveContainer width="100%" height={Math.max(160, top.length * 34)}>
        <BarChart data={top} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
          <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={compactCurrency} />
          <YAxis type="category" dataKey="categoryName" tick={AXIS_TICK} axisLine={false} tickLine={false} width={110} />
          <Tooltip formatter={(value: number) => formatCurrencyTRY(value)} contentStyle={{ fontSize: 12 }} />
          <Bar dataKey="total" fill={COLOR_SEQ_BASE} radius={[0, 4, 4, 0]} barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function QuoteFunnelChart({
  data,
  title,
}: {
  data: { stage: string; count: number }[];
  title: string;
}) {
  const isEmpty = data.every((d) => d.count === 0);
  return (
    <ChartCard title={title} empty={isEmpty ? "Henüz teklif yok." : undefined}>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, left: 8, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
          <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="stage" tick={AXIS_TICK} axisLine={false} tickLine={false} width={110} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={22} label={{ position: "right", fill: "#374151", fontSize: 12 }}>
            {data.map((_, i) => (
              <Cell key={data[i].stage} fill={COLOR_FUNNEL[i] ?? COLOR_FUNNEL[COLOR_FUNNEL.length - 1]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
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
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 30)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
          <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={compactCurrency} />
          <YAxis type="category" dataKey="customerTitle" tick={AXIS_TICK} axisLine={false} tickLine={false} width={130} />
          <Tooltip formatter={(value: number) => formatCurrencyTRY(value)} contentStyle={{ fontSize: 12 }} />
          <Bar dataKey="revenue" fill={COLOR_SEQ_BASE} radius={[0, 4, 4, 0]} barSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
