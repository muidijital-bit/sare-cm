import { getTenantSession } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getTenantSession();

  // Aktif şirket henüz seçilmemiş (örn. /app/sirket-sec) — çerçevesiz geçiş.
  // Gösterilecek bir şirket adı/menü olmadığından tam ekran kendi düzenini kullanır.
  if (!session) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  return (
    <AppShell
      companyName={session.companyName}
      role={session.role}
      userName={session.userName}
      userEmail={session.userEmail}
      hasMultipleCompanies={session.membershipCount > 1}
    >
      {children}
    </AppShell>
  );
}
