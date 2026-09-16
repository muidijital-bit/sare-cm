"use client";

import { useEffect, useState } from "react";
import { tr, formatDateTR } from "@/lib/i18n/tr";

interface AuditLogRow {
  id: string;
  action: keyof typeof tr.audit.action;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
  changes: Record<string, { eski: unknown; yeni: unknown }> | null;
}

/**
 * IG-05: "Kayıt detay ekranında değişiklik geçmişi sekmesi" — herhangi bir kayıt
 * detay sayfasına gömülebilen, tek bir entity'nin audit geçmişini gösteren bileşen.
 * Görünürlük zaten API/servis katmanında RBAC ile kısıtlı (yalnızca Sahip/Yönetici) —
 * bu bileşen yetkisi olmayan bir kullanıcı için sessizce boş/hata döner.
 */
export function AuditTrail({ entityType, entityId }: { entityType: string; entityId: string }) {
  const [logs, setLogs] = useState<AuditLogRow[] | null>(null);

  useEffect(() => {
    fetch(`/api/audit-logs?entityType=${entityType}&entityId=${entityId}&pageSize=50`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setLogs(data?.items ?? []))
      .catch(() => setLogs([]));
  }, [entityType, entityId]);

  if (logs === null) return null; // yetkisiz kullanıcıya sessizce hiçbir şey göstermez
  if (logs.length === 0) return <p className="text-sm text-gray-400">{tr.audit.changeHistoryEmpty}</p>;

  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-gray-900">{tr.audit.changeHistory}</h2>
      <ul className="space-y-2">
        {logs.map((log) => (
          <li key={log.id} className="rounded-md border border-gray-200 bg-white p-3 text-sm">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                {log.userName ?? tr.audit.system} · {tr.audit.action[log.action] ?? log.action}
              </span>
              <span>{formatDateTR(new Date(log.createdAt))}</span>
            </div>
            {log.changes && Object.keys(log.changes).length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
                {Object.entries(log.changes).map(([field, diff]) => (
                  <li key={field}>
                    <span className="font-medium">{field}</span>: {String(diff.eski ?? "—")} → {String(diff.yeni ?? "—")}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
