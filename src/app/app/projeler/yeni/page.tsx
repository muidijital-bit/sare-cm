import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/tenant-context";
import { getScope } from "@/lib/auth/access";
import { AccessDenied } from "@/components/ui/access-denied";
import { tr } from "@/lib/i18n/tr";
import { ProjectForm } from "../_components/project-form";

export default async function YeniProjePage({ searchParams }: { searchParams: { customerId?: string } }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  if (!getScope(session, "project", "view")) return <AccessDenied session={session} module="project" />;
  if (!getScope(session, "project", "create")) return <p className="text-sm text-gray-500">Proje oluşturma yetkiniz yok.</p>;

  // Müşteri listesi müşteri modülünün kapsamına tabidir (satış: yalnızca kendi müşterileri).
  const customerScope = getScope(session, "customer", "view");
  const customers = await withTenant(session.companyId, (tx) =>
    tx.customer.findMany({
      where: { deletedAt: null, ...(customerScope === "own" ? { ownerUserId: session.userId } : {}) },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  );

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-gray-800">{tr.project.new}</h1>
      <ProjectForm mode="create" customers={customers} initialValues={searchParams.customerId ? { customerId: searchParams.customerId } : undefined} />
    </div>
  );
}
