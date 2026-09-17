"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { tr } from "@/lib/i18n/tr";
import { InstantTableSearch } from "@/components/ui/instant-table-search";
import { startRouteLoading } from "@/lib/ui/route-loading";

interface Props {
  categories: { id: string; name: string }[];
  rowCount: number;
}

/** Arama (anında, istemci taraflı) + kategori + tarih aralığı filtresi; dropdown/tarihler URL query string ile senkron. */
export function ExpenseFilterBar({ categories, rowCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    startRouteLoading();
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <InstantTableSearch
        rowSelector="searchable-row-expenses"
        placeholder={tr.expense.searchPlaceholder}
        serverQuery={searchParams.get("q") ?? undefined}
        onServerSearch={(v) => updateParam("q", v)}
        totalOnPage={rowCount}
      />

      <select
        value={searchParams.get("categoryId") ?? ""}
        onChange={(e) => updateParam("categoryId", e.target.value)}
        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
      >
        <option value="">Tüm kategoriler</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <label className="flex items-center gap-1 text-xs text-gray-500">
        Başlangıç
        <input
          type="date"
          defaultValue={searchParams.get("dateFrom") ?? ""}
          onChange={(e) => updateParam("dateFrom", e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900"
        />
      </label>
      <label className="flex items-center gap-1 text-xs text-gray-500">
        Bitiş
        <input
          type="date"
          defaultValue={searchParams.get("dateTo") ?? ""}
          onChange={(e) => updateParam("dateTo", e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900"
        />
      </label>
    </div>
  );
}
