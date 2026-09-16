import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/tenant-context";
import { listAuditLogs } from "@/lib/modules/audit/service";
import { listAuditLogsQuerySchema } from "@/lib/validation/audit";
import { getRequiredScope } from "@/lib/auth/rbac";
import { tr, formatDateTR } from "@/lib/i18n/tr";
import { AuditFilterBar } from "./_components/audit-filter-bar";

export default async function IslemGecmisiPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const scope = getRequiredScope(session.role, "auditLog", "view");
  if (!scope) return <p className="text-sm text-gray-500">Bu modülü görüntüleme yetkiniz yok.</p>;

  const parsed = listAuditLogsQuerySchema.safeParse(searchParams);
  const query = parsed.success ? parsed.data : { page: 1, pageSize: 30 };

  const [result, users] = await Promise.all([
    listAuditLogs(session, query),
    withTenant(session.companyId, (tx) =>
      tx.membership.findMany({ where: { isActive: true }, include: { user: { select: { id: true, name: true } } }, orderBy: { user: { name: "asc" } } }),
    ),
  ]);

  if (!result.ok) return <p className="text-sm text-red-600">{result.message}</p>;
  const { items, total, page, pageSize } = result.data;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold text-gray-900">{tr.audit.title}</h1>

      <AuditFilterBar users={users.map((m) => ({ id: m.user.id, name: m.user.name }))} />

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">{tr.audit.fields.date}</th>
              <th className="px-4 py-3">{tr.audit.fields.user}</th>
              <th className="px-4 py-3">{tr.audit.fields.action}</th>
              <th className="px-4 py-3">{tr.audit.fields.entity}</th>
              <th className="px-4 py-3">{tr.audit.fields.changes}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  {tr.audit.empty}
                </td>
              </tr>
            )}
            {items.map((log) => (
              <tr key={log.id}>
                <td className="px-4 py-3 text-gray-600">{formatDateTR(new Date(log.createdAt))}</td>
                <td className="px-4 py-3 text-gray-900">{log.userName ?? tr.audit.system}</td>
                <td className="px-4 py-3 text-gray-600">{tr.audit.action[log.action as keyof typeof tr.audit.action] ?? log.action}</td>
                <td className="px-4 py-3 text-gray-600">
                  {log.entityType ? tr.audit.entityType[log.entityType as keyof typeof tr.audit.entityType] ?? log.entityType : "—"}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {log.changes && typeof log.changes === "object"
                    ? Object.entries(log.changes as Record<string, { eski: unknown; yeni: unknown }>)
                        .map(([field, diff]) => `${field}: ${String(diff.eski ?? "—")} → ${String(diff.yeni ?? "—")}`)
                        .join(", ")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <a key={p} href={`?${new URLSearchParams({ ...searchParams, page: String(p) } as Record<string, string>).toString()}`} className={`rounded-md px-3 py-1 ${p === page ? "bg-brand-800 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
