"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { tr } from "@/lib/i18n/tr";
import { InstantTableSearch } from "@/components/ui/instant-table-search";
import { startRouteLoading } from "@/lib/ui/route-loading";

interface Props {
  sources: { id: string; name: string }[];
  showOwnerFilter: boolean;
  users: { id: string; name: string }[];
  rowCount: number;
}

/**
 * MC-11: arama + filtre. Arama kutusu ANINDA (sunucuya gitmeden) o an yüklü satırları
 * filtreler; Enter'a basılırsa tüm kayıtlarda sunucu taraflı arama yapılır. Dropdown
 * filtreleri URL query string ile senkron (paylaşılabilir link, geri tuşu çalışır).
 */
export function CustomerFilterBar({ sources, showOwnerFilter, users, rowCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page"); // filtre değişince ilk sayfaya dön
    startRouteLoading();
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <InstantTableSearch
        rowSelector="searchable-row-customers"
        placeholder={tr.customer.searchPlaceholder}
        serverQuery={searchParams.get("q") ?? undefined}
        onServerSearch={(v) => updateParam("q", v)}
        totalOnPage={rowCount}
      />

      <select
        value={searchParams.get("status") ?? ""}
        onChange={(e) => updateParam("status", e.target.value)}
        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
      >
        <option value="">Tüm durumlar</option>
        {Object.entries(tr.customer.status).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <select
        value={searchParams.get("sourceId") ?? ""}
        onChange={(e) => updateParam("sourceId", e.target.value)}
        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
      >
        <option value="">Tüm kaynaklar</option>
        {sources.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      {showOwnerFilter && (
        <select
          value={searchParams.get("ownerUserId") ?? ""}
          onChange={(e) => updateParam("ownerUserId", e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
        >
          <option value="">Tüm sorumlular</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
