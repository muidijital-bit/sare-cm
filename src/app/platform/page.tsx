import { redirect } from "next/navigation";
import { getSuperAdminSession } from "@/lib/auth/session";
import { LogoutButton } from "@/components/logout-button";
import { tr } from "@/lib/i18n/tr";

export default async function PlatformPage() {
  const session = await getSuperAdminSession();
  if (!session) {
    redirect("/giris");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">{tr.platform.title}</h1>
        <LogoutButton />
      </header>
      <p className="text-sm text-brand-300">
        Şirket listesi, paket yönetimi, kullanım özetleri (PF-01..PF-08) burada oluşturulacak —
        bkz. docs/v1-isterler-dokumani.md §5.1. Zorunlu 2FA doğrulaması henüz tamamlanmadı
        (bkz. src/lib/auth/session.ts TODO notu).
      </p>
    </div>
  );
}
