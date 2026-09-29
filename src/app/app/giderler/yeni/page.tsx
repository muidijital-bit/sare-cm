import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/tenant-context";
import { getScope } from "@/lib/auth/access";
import { tr } from "@/lib/i18n/tr";
import { listProjectOptions } from "@/lib/modules/projects/service";
import { ExpenseForm } from "../_components/expense-form";

export default async function YeniGiderPage({ searchParams }: { searchParams: { projectId?: string } }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const scope = getScope(session, "expense", "create");
  if (!scope) return <p className="text-sm text-gray-500">Gider ekleme yetkiniz yok.</p>;

  const [categories, accounts, projects] = await Promise.all([
    withTenant(session.companyId, (tx) => tx.expenseCategory.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } })),
    withTenant(session.companyId, (tx) => tx.account.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })),
    listProjectOptions(session),
  ]);
  const presetProject = projects.find((p) => p.id === searchParams.projectId);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-gray-800">{tr.expense.new}</h1>
      <ExpenseForm
        mode="create"
        categories={categories}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        projects={projects}
        initialValues={presetProject ? { projectId: presetProject.id } : undefined}
        returnTo={presetProject ? `/app/projeler/${presetProject.id}` : undefined}
      />
    </div>
  );
}
