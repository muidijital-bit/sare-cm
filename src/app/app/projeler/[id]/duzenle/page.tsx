import { redirect, notFound } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/tenant-context";
import { getScope } from "@/lib/auth/access";
import { getProject } from "@/lib/modules/projects/service";
import { tr } from "@/lib/i18n/tr";
import { ProjectForm } from "../../_components/project-form";

const toDateInput = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export default async function ProjeDuzenlePage({ params }: { params: { id: string } }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  if (!getScope(session, "project", "edit")) return <p className="text-sm text-gray-500">Bu kaydı düzenleme yetkiniz yok.</p>;

  const result = await getProject(session, params.id);
  if (!result.ok) {
    if (result.status === 404) notFound();
    return <p className="text-sm text-red-600">{result.message}</p>;
  }
  const p = result.data.project;

  const customerScope = getScope(session, "customer", "view");
  const customers = await withTenant(session.companyId, (tx) =>
    tx.customer.findMany({
      where: { deletedAt: null, OR: [{ id: p.customerId }, customerScope === "own" ? { ownerUserId: session.userId } : {}] },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  );

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-gray-800">{tr.project.edit}</h1>
      <ProjectForm
        mode="edit"
        projectId={p.id}
        customers={customers}
        initialValues={{
          name: p.name,
          customerId: p.customerId,
          status: p.status,
          location: p.location ?? "",
          startDate: toDateInput(p.startDate),
          endDate: toDateInput(p.endDate),
          contractAmount: p.contractAmount.toString(),
          note: p.note ?? "",
        }}
      />
    </div>
  );
}
