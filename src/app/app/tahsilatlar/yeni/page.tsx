import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/tenant-context";
import { getRequiredScope } from "@/lib/auth/rbac";
import { tr } from "@/lib/i18n/tr";
import { PaymentForm } from "../_components/payment-form";

export default async function YeniTahsilatPage() {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const scope = getRequiredScope(session.role, "payment", "create");
  if (!scope) return <p className="text-sm text-gray-500">Tahsilat oluşturma yetkiniz yok.</p>;

  const [customers, accounts] = await Promise.all([
    withTenant(session.companyId, (tx) => tx.customer.findMany({ where: { deletedAt: null }, orderBy: { title: "asc" }, select: { id: true, title: true } })),
    withTenant(session.companyId, (tx) => tx.account.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-lg font-semibold text-gray-900">{tr.payment.new}</h1>
      <PaymentForm customers={customers} accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} />
    </div>
  );
}
