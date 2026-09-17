"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { tr } from "@/lib/i18n/tr";
import { InstantTableSearch } from "@/components/ui/instant-table-search";
import { startRouteLoading } from "@/lib/ui/route-loading";

interface Props {
  rowCount: number;
}

/** Arama (anında, istemci taraflı) + ödeme yöntemi filtresi; dropdown URL query string ile senkron. */
export function PaymentFilterBar({ rowCount }: Props) {
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
        rowSelector="searchable-row-payments"
        placeholder={tr.payment.searchPlaceholder}
        serverQuery={searchParams.get("q") ?? undefined}
        onServerSearch={(v) => updateParam("q", v)}
        totalOnPage={rowCount}
      />

      <select
        value={searchParams.get("method") ?? ""}
        onChange={(e) => updateParam("method", e.target.value)}
        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
      >
        <option value="">Tüm yöntemler</option>
        {Object.entries(tr.payment.method).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
