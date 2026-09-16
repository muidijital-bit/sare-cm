import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { getCustomer } from "@/lib/modules/customers/service";
import { withTenant } from "@/lib/db/tenant-context";
import { getRequiredScope } from "@/lib/auth/rbac";
import { tr } from "@/lib/i18n/tr";
import { CustomerForm } from "../../_components/customer-form";

export default async function MusteriDuzenlePage({ params }: { params: { id: string } }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const scope = getRequiredScope(session.role, "customer", "edit");
  if (!scope) {
    return <p className="text-sm text-gray-500">Bu kaydı düzenleme yetkiniz yok.</p>;
  }

  const result = await getCustomer(session, params.id);
  if (!result.ok) {
    return <p className="text-sm text-red-600">{result.message}</p>;
  }
  const customer = result.data;

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
      <h1 className="mb-6 text-lg font-semibold text-gray-900">{tr.customer.edit}</h1>
      <CustomerForm
        mode="edit"
        customerId={customer.id}
        initialValues={{
          type: customer.type,
          title: customer.title,
          taxOffice: customer.taxOffice ?? "",
          taxNumber: customer.taxNumber ?? "",
          address: customer.address ?? "",
          sourceId: customer.sourceId ?? "",
          status: customer.status,
          ownerUserId: customer.ownerUserId ?? "",
          tags: customer.tags.map((t) => t.tag.name).join(", "),
          contacts: customer.contacts.map((c) => ({
            id: c.id,
            name: c.name,
            position: c.position ?? "",
            phone: c.phone ?? "",
            email: c.email ?? "",
            isPrimary: c.isPrimary,
          })),
        }}
        sources={sources}
        users={users.map((m) => ({ id: m.user.id, name: m.user.name }))}
        canAssignOwner={scope === "all"}
      />
    </div>
  );
}
