"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { tr } from "@/lib/i18n/tr";

interface Props {
  showOwnerFilter: boolean;
  users: { id: string; name: string }[];
}

/** Arama + durum + (yetkiliyse) sorumlu filtresi; URL query string ile senkron. */
export function OrderFilterBar({ showOwnerFilter, users }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    updateParam("q", q);
  }

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <form onSubmit={handleSearchSubmit} className="min-w-[220px] flex-1">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tr.order.searchPlaceholder}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
        />
      </form>

      <select
        value={searchParams.get("status") ?? ""}
        onChange={(e) => updateParam("status", e.target.value)}
        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
      >
        <option value="">Tüm durumlar</option>
        {Object.entries(tr.order.status).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
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
