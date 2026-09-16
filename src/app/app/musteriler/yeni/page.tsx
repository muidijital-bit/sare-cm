import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/tenant-context";
import { getRequiredScope } from "@/lib/auth/rbac";
import { tr } from "@/lib/i18n/tr";
import { CustomerForm } from "../_components/customer-form";

export default async function YeniMusteriPage() {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const scope = getRequiredScope(session.role, "customer", "create");
  if (!scope) {
    return <p className="text-sm text-gray-500">Müşteri ekleme yetkiniz yok.</p>;
  }

  const [sources, users] = await Promise.all([
    withTenant(session.companyId, (tx) =>
      tx.customerSource.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ),
    scope === "all"
      ? withTenant(session.companyId, (tx) =>
          tx.membership.findMany({
            where: { isActive: true },
            include: { user: { select: { id: true, name: true } } },
            orderBy: { user: { name: "asc" } },
          }),
        )
      : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-lg font-semibold text-gray-900">{tr.customer.new}</h1>
      <CustomerForm
        mode="create"
        sources={sources}
        users={users.map((m) => ({ id: m.user.id, name: m.user.name }))}
        canAssignOwner={scope === "all"}
      />
    </div>
  );
}
