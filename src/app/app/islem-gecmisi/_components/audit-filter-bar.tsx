"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { tr } from "@/lib/i18n/tr";

interface Props {
  users: { id: string; name: string }[];
}

export function AuditFilterBar({ users }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <select value={searchParams.get("userId") ?? ""} onChange={(e) => updateParam("userId", e.target.value)} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
        <option value="">{tr.audit.fields.user}: Tümü</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>

      <select value={searchParams.get("entityType") ?? ""} onChange={(e) => updateParam("entityType", e.target.value)} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
        <option value="">Modül: Tümü</option>
        {Object.entries(tr.audit.entityType).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <select value={searchParams.get("action") ?? ""} onChange={(e) => updateParam("action", e.target.value)} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
        <option value="">İşlem: Tümü</option>
        {Object.entries(tr.audit.action).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <input type="date" value={searchParams.get("dateFrom") ?? ""} onChange={(e) => updateParam("dateFrom", e.target.value)} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
      <input type="date" value={searchParams.get("dateTo") ?? ""} onChange={(e) => updateParam("dateTo", e.target.value)} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
    </div>
  );
}
