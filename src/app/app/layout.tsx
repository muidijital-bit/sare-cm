import { getTenantSession } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell/app-shell";
import { TermsBanner } from "@/components/legal/terms-banner";
import { prisma } from "@/lib/db/prisma";
import { LEGAL } from "@/lib/legal";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getTenantSession();

  // Aktif şirket henüz seçilmemiş (örn. /app/sirket-sec) — çerçevesiz geçiş.
  // Gösterilecek bir şirket adı/menü olmadığından tam ekran kendi düzenini kullanır.
  if (!session) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  // Güncel yasal metin sürümü onaylanmamışsa (eski kullanıcılar / metin güncellemesi) şerit gösterilir.
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { termsVersion: true } });
  const needsTerms = user?.termsVersion !== LEGAL.version;

  return (
    <AppShell
      companyName={session.companyName}
      role={session.role}
      userName={session.userName}
      userEmail={session.userEmail}
      hasMultipleCompanies={session.membershipCount > 1}
      enabledModules={session.enabledModules}
    >
      {needsTerms && <TermsBanner />}
      {children}
    </AppShell>
  );
}
