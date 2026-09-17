import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { getCompanySettings } from "@/lib/modules/company-settings/service";
import { withTenant } from "@/lib/db/tenant-context";
import { getRequiredScope } from "@/lib/auth/rbac";
import { tr } from "@/lib/i18n/tr";
import { CompanyInfoForm } from "./_components/company-info-form";
import { NamedRefList } from "./_components/named-ref-list";
import { AccountList } from "./_components/account-list";

export default async function AyarlarPage() {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  if (!getRequiredScope(session.role, "companySettings", "view")) {
    return <p className="text-sm text-gray-500">Bu sayfayı görüntüleme yetkiniz yok.</p>;
  }

  const [companyResult, sources, categories, accounts] = await Promise.all([
    getCompanySettings(session),
    withTenant(session.companyId, (tx) => tx.customerSource.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } })),
    withTenant(session.companyId, (tx) => tx.expenseCategory.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } })),
    withTenant(session.companyId, (tx) => tx.account.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, type: true } })),
  ]);

  if (!companyResult.ok) return <p className="text-sm text-red-600">{companyResult.message}</p>;
  const company = companyResult.data;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-900">{tr.settings.title}</h1>

      <CompanyInfoForm
        initialValues={{
          name: company.name,
          taxOffice: company.taxOffice ?? "",
          taxNumber: company.taxNumber ?? "",
          address: company.address ?? "",
          phone: company.phone ?? "",
          defaultVatRate: String(company.defaultVatRate),
          quoteValidityDays: String(company.quoteValidityDays),
          quoteNumberFormat: company.quoteNumberFormat,
          orderNumberFormat: company.orderNumberFormat,
        }}
      />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <NamedRefList title={tr.settings.sources} apiBase="/api/customer-sources" items={sources} />
        <NamedRefList title={tr.settings.expenseCategories} apiBase="/api/expense-categories" items={categories} />
        <AccountList items={accounts} />
      </div>
    </div>
  );
}
