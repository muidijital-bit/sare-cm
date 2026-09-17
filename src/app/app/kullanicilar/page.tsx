import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { listCompanyUsers } from "@/lib/modules/users/service";
import { getRequiredScope } from "@/lib/auth/rbac";
import { tr } from "@/lib/i18n/tr";
import { InviteForm } from "./_components/invite-form";
import { UserList } from "./_components/user-list";

export default async function KullanicilarPage() {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  if (!getRequiredScope(session.role, "userManagement", "view")) {
    return <p className="text-sm text-gray-500">Bu sayfayı görüntüleme yetkiniz yok.</p>;
  }

  const result = await listCompanyUsers(session);
  if (!result.ok) return <p className="text-sm text-red-600">{result.message}</p>;

  const canInvite = !!getRequiredScope(session.role, "userManagement", "create");

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-900">{tr.users.title}</h1>
      {canInvite && <InviteForm />}
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
