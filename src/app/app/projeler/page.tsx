import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { listProjects } from "@/lib/modules/projects/service";
import { listProjectsQuerySchema } from "@/lib/validation/project";
import { withTenant } from "@/lib/db/tenant-context";
import { GridFilters } from "@/components/ui/grid-filters";
import { exportKeyFor } from "@/lib/export/registry";
import { getScope } from "@/lib/auth/access";
import { AccessDenied } from "@/components/ui/access-denied";
import { tr, formatCurrencyTRY, formatDateTR } from "@/lib/i18n/tr";
import { Badge, PROJECT_STATUS_COLORS } from "@/components/ui/badge";

export default async function ProjelerPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const scope = getScope(session, "project", "view");
  if (!scope) return <AccessDenied session={session} module="project" />;

  const parsed = listProjectsQuerySchema.safeParse(searchParams);
  const query = parsed.success ? parsed.data : { page: 1, pageSize: 20 };
  const result = await listProjects(session, query);
  if (!result.ok) return <p className="text-sm text-red-600">{result.message}</p>;

  const { items, total, page, pageSize } = result.data;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canCreate = !!getScope(session, "project", "create");
  const customerScope = getScope(session, "customer", "view");
  const customers = await withTenant(session.companyId, (tx) =>
    tx.customer.findMany({
      where: { deletedAt: null, projects: { some: { deletedAt: null } }, ...(customerScope === "own" ? { ownerUserId: session.userId } : {}) },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-800">{tr.project.title}</h1>
        {canCreate && (
          <Link href="/app/projeler/yeni" className="rounded-lg bg-brand-800 shadow-theme-xs px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            + {tr.project.new}
          </Link>
        )}
      </div>

      <GridFilters
        exportKey={exportKeyFor(session, "projeler")}
        search={{ rowSelector: "searchable-row-projects", placeholder: "Proje, no, konum veya müşteri ara…" }}
        rowCount={items.length}
        total={total}
        selects={[
          { param: "status", placeholder: "Tüm durumlar", options: Object.entries(tr.project.status).map(([value, label]) => ({ value, label })) },
          ...(customers.length > 0 ? [{ param: "customerId", placeholder: "Tüm müşteriler", options: customers.map((c) => ({ value: c.id, label: c.title })) }] : []),
        ]}
      />

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-theme-xs">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-theme-xs font-medium text-gray-500">
            <tr>
              <th className="px-4 py-3">{tr.project.fields.number}</th>
              <th className="px-4 py-3">{tr.project.fields.name}</th>
              <th className="px-4 py-3">{tr.project.fields.customer}</th>
              <th className="px-4 py-3">{tr.project.fields.startDate}</th>
              <th className="px-4 py-3">{tr.project.fields.status}</th>
              <th className="px-4 py-3 text-right">{tr.project.summary.contract}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  {tr.project.empty}
                </td>
              </tr>
            )}
            {items.map((p) => (
              <tr key={p.id} className="searchable-row-projects" data-search={[p.number, p.name, p.location, p.customer.title].filter(Boolean).join(" ")} >
                <td className="px-4 py-3 text-gray-500">{p.number}</td>
                <td className="px-4 py-3">
                  <Link href={`/app/projeler/${p.id}`} className="font-medium text-gray-900 hover:underline">
                    {p.name}
                  </Link>
                  {p.location && <p className="text-xs text-gray-400">{p.location}</p>}
                </td>
                <td className="px-4 py-3 text-gray-600">{p.customer.title}</td>
                <td className="px-4 py-3 text-gray-600">{p.startDate ? formatDateTR(new Date(p.startDate)) : "—"}</td>
                <td className="px-4 py-3">
                  <Badge color={PROJECT_STATUS_COLORS[p.status]}>{tr.project.status[p.status]}</Badge>
                </td>
                <td className="px-4 py-3 text-right text-gray-900">{formatCurrencyTRY(Number(p.contractAmount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={{ pathname: "/app/projeler", query: { ...searchParams, page: n } }}
              className={`rounded-md px-3 py-1 ${n === page ? "bg-brand-800 text-white" : "text-gray-600 hover:bg-gray-100"}`}
            >
              {n}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
