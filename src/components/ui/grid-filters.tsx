"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Download, X, Calendar } from "react-feather";
import { InstantTableSearch } from "@/components/ui/instant-table-search";
import { startRouteLoading } from "@/lib/ui/route-loading";

export interface GridSelectFilter {
  /** URL parametresi (servis/şema ile aynı ad). */
  param: string;
  /** Boş seçenek metni, örn. "Tüm durumlar". */
  placeholder: string;
  options: { value: string; label: string }[];
}

interface Props {
  /** /api/export/<exportKey> — verilmezse Excel düğmesi gösterilmez. */
  exportKey?: string;
  /** Anında (istemci) arama; `rowSelector` satırlardaki class. Enter → sunucuda tüm kayıtlarda arar (q). */
  search?: { rowSelector: string; placeholder: string };
  rowCount: number;
  /** Filtreye uyan toplam kayıt (sayfalama öncesi). */
  total?: number;
  selects?: GridSelectFilter[];
  /** Tarih aralığı filtresi (dateFrom/dateTo) — etiket örn. "Sipariş tarihi". */
  dateRange?: { label: string };
}

const CONTROL =
  "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Tüm gridlerin ortak filtre/araç çubuğu: anında arama, açılır filtreler, tarih aralığı (+ hazır
 * aralıklar), aktif filtre sayısı, "Temizle" ve filtreye uyan TÜM kayıtları .xlsx indiren
 * "Excel'e Aktar". Tüm durum URL'de tutulur (paylaşılabilir link, geri tuşu çalışır).
 */
export function GridFilters({ exportKey, search, rowCount, total, selects = [], dateRange }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function push(params: URLSearchParams) {
    params.delete("page");
    startRouteLoading();
    router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  }
  function update(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    push(params);
  }
  function preset(kind: "month" | "30d" | "year") {
    const now = new Date();
    const from = kind === "month" ? new Date(now.getFullYear(), now.getMonth(), 1) : kind === "year" ? new Date(now.getFullYear(), 0, 1) : new Date(now.getTime() - 29 * 86400000);
    update({ dateFrom: ymd(from), dateTo: ymd(now) });
  }

  const filterKeys = ["q", ...selects.map((s) => s.param), ...(dateRange ? ["dateFrom", "dateTo"] : [])];
  const activeCount = filterKeys.filter((k) => searchParams.get(k)).length;
  const exportHref = exportKey ? `/api/export/${exportKey}${searchParams.toString() ? `?${searchParams.toString()}` : ""}` : null;

  return (
    <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-xs">
      <div className="flex flex-wrap items-end gap-2.5">
        {search && (
          <InstantTableSearch
            rowSelector={search.rowSelector}
            placeholder={search.placeholder}
            serverQuery={searchParams.get("q") ?? undefined}
            onServerSearch={(v) => update({ q: v })}
            totalOnPage={rowCount}
          />
        )}

        {selects.map((s) => (
          <select
            key={s.param}
            value={searchParams.get(s.param) ?? ""}
            onChange={(e) => update({ [s.param]: e.target.value })}
            className={`${CONTROL} ${searchParams.get(s.param) ? "border-violet-300 bg-violet-50/60" : ""}`}
          >
            <option value="">{s.placeholder}</option>
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ))}

        {dateRange && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1 text-xs font-medium text-gray-500">
              <Calendar size={13} /> {dateRange.label}
            </span>
            <input
              type="date"
              aria-label="Başlangıç tarihi"
              value={searchParams.get("dateFrom") ?? ""}
              onChange={(e) => update({ dateFrom: e.target.value })}
              className={`${CONTROL} px-2`}
            />
            <span className="text-gray-400">–</span>
            <input
              type="date"
              aria-label="Bitiş tarihi"
              value={searchParams.get("dateTo") ?? ""}
              onChange={(e) => update({ dateTo: e.target.value })}
              className={`${CONTROL} px-2`}
            />
            <div className="flex gap-1">
              {(
                [
                  ["month", "Bu ay"],
                  ["30d", "30 gün"],
                  ["year", "Bu yıl"],
                ] as const
              ).map(([k, l]) => (
                <button key={k} type="button" onClick={() => preset(k)} className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:border-violet-300 hover:text-violet-700">
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {total != null && (
            <span className="text-xs text-gray-500">
              <span className="font-semibold text-gray-800">{total.toLocaleString("tr-TR")}</span> kayıt
            </span>
          )}
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                filterKeys.forEach((k) => params.delete(k));
                push(params);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <X size={13} /> Temizle ({activeCount})
            </button>
          )}
          {exportHref && (
            <a
              href={exportHref}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-theme-xs hover:bg-emerald-700"
              title="Filtreye uyan tüm kayıtları Excel (.xlsx) olarak indir"
            >
              <Download size={14} /> Excel&apos;e Aktar
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
