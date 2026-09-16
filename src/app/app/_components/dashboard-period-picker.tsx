"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

export function DashboardPeriodPicker({ defaultFrom, defaultTo }: { defaultFrom: string; defaultTo: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [from, setFrom] = useState(searchParams.get("from") ?? defaultFrom);
  const [to, setTo] = useState(searchParams.get("to") ?? defaultTo);

  function apply() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", from);
    params.set("to", to);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-2 text-sm">
      <div>
        <label className="block text-xs text-gray-500">Başlangıç</label>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900" />
      </div>
      <div>
        <label className="block text-xs text-gray-500">Bitiş</label>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900" />
      </div>
      <button onClick={apply} className="rounded-md bg-brand-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
        Uygula
      </button>
    </div>
  );
}
