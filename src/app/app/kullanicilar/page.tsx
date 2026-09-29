import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { listCompanyUsers } from "@/lib/modules/users/service";
import { getScope } from "@/lib/auth/access";
import { tr } from "@/lib/i18n/tr";
import { InviteForm } from "./_components/invite-form";
import { UserList } from "./_components/user-list";
import { GridFilters } from "@/components/ui/grid-filters";
import { exportKeyFor } from "@/lib/export/registry";

export default async function KullanicilarPage() {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  if (!getScope(session, "userManagement", "view")) {
    return <p className="text-sm text-gray-500">Bu sayfayı görüntüleme yetkiniz yok.</p>;
  }

  const result = await listCompanyUsers(session);
  if (!result.ok) return <p className="text-sm text-red-600">{result.message}</p>;

  const canInvite = !!getScope(session, "userManagement", "create");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-800">{tr.users.title}</h1>
      {canInvite && <InviteForm />}
      <div>
        <GridFilters exportKey={exportKeyFor(session, "kullanicilar")} rowCount={result.data.length} total={result.data.length} />
      </div>
      <UserList
        rows={result.data.map((r) => ({
          kind: r.kind,
          id: r.id,
          email: r.email,
          name: r.name,
          role: r.role,
          isActive: r.isActive,
        }))}
      />
    </div>
  );
}
