"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { tr } from "@/lib/i18n/tr";

interface Props {
  categories: { id: string; name: string }[];
}

/** Arama + kategori + tarih aralığı filtresi; URL query string ile senkron. */
export function ExpenseFilterBar({ categories }: Props) {
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
          placeholder={tr.expense.searchPlaceholder}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
        />
      </form>

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
