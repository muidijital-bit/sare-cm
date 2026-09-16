import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/tenant-context";
import { getRequiredScope } from "@/lib/auth/rbac";
import { tr } from "@/lib/i18n/tr";
import { ExpenseForm } from "../_components/expense-form";

export default async function YeniGiderPage() {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const scope = getRequiredScope(session.role, "expense", "create");
  if (!scope) return <p className="text-sm text-gray-500">Gider ekleme yetkiniz yok.</p>;

  const [categories, accounts] = await Promise.all([
    withTenant(session.companyId, (tx) => tx.expenseCategory.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } })),
    withTenant(session.companyId, (tx) => tx.account.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-lg font-semibold text-gray-900">{tr.expense.new}</h1>
      <ExpenseForm mode="create" categories={categories} accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} />
    </div>
  );
}
