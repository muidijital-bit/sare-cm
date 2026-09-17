import { redirect } from "next/navigation";
import { getSuperAdminSession } from "@/lib/auth/session";
import { listCompanies, listPlans } from "@/lib/modules/platform/service";
import { LogoutButton } from "@/components/logout-button";
import { tr } from "@/lib/i18n/tr";
import { CompanyList } from "./_components/company-list";
import { PlanList } from "./_components/plan-list";

export default async function PlatformPage() {
  const session = await getSuperAdminSession();
  if (!session) {
    redirect("/giris");
  }

  const [companies, plans] = await Promise.all([listCompanies(), listPlans()]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">{tr.platform.title}</h1>
        <LogoutButton />
      </header>

      <p className="mb-4 text-xs text-brand-300">
        Zorunlu 2FA doğrulaması henüz tamamlanmadı (bkz. src/lib/auth/session.ts TODO notu). PF-05
        (abonelik bitişi yaklaşanlar) ve PF-07 (destek amaçlı geçici erişim) bu sürümde yok.
      </p>

      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold text-white">{tr.platform.companies}</h2>
        <CompanyList companies={companies.map((c) => ({ ...c, subscriptionEndsAt: c.subscriptionEndsAt?.toISOString() ?? null }))} plans={plans} />
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-white">{tr.platform.plans}</h2>
        <PlanList plans={plans.map((p) => ({ ...p, price: p.price.toString() }))} />
      </section>
    </div>
  );
}
