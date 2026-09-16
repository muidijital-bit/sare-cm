import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { getExpense } from "@/lib/modules/expenses/service";
import { withTenant } from "@/lib/db/tenant-context";
import { getRequiredScope } from "@/lib/auth/rbac";
import { tr } from "@/lib/i18n/tr";
import { ExpenseForm } from "../../_components/expense-form";

export default async function GiderDuzenlePage({ params }: { params: { id: string } }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const scope = getRequiredScope(session.role, "expense", "edit");
  if (!scope) return <p className="text-sm text-gray-500">Bu kaydı düzenleme yetkiniz yok.</p>;

  const result = await getExpense(session, params.id);
  if (!result.ok) return <p className="text-sm text-red-600">{result.message}</p>;
  const expense = result.data;

  const [categories, accounts] = await Promise.all([
    withTenant(session.companyId, (tx) => tx.expenseCategory.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } })),
    withTenant(session.companyId, (tx) => tx.account.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-lg font-semibold text-gray-900">{tr.expense.edit}</h1>
      {expense.parentExpenseId && <p className="mb-4 text-xs text-amber-700">{tr.expense.recurring.generatedNote}</p>}
      <ExpenseForm
        mode="edit"
        expenseId={expense.id}
        initialValues={{
          categoryId: expense.categoryId,
          spentAt: new Date(expense.spentAt).toISOString().slice(0, 10),
          amount: String(expense.amount),
          vatAmount: String(expense.vatAmount),
          vendor: expense.vendor ?? "",
          method: expense.method ?? "",
          accountId: expense.accountId ?? "",
          note: expense.note ?? "",
        }}
        categories={categories}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
      />
    </div>
  );
}
