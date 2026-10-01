import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { getScope } from "@/lib/auth/access";
import { withTenant } from "@/lib/db/tenant-context";
import { AccessDenied } from "@/components/ui/access-denied";
import { Badge } from "@/components/ui/badge";
import { canManageTemplates, getWorkbook } from "@/lib/modules/quote-templates/service";
import { WorkbookEditor } from "../_components/workbook-editor";

export default async function SablonDetayPage({ params }: { params: { id: string } }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");
  if (!getScope(session, "quote", "view")) return <AccessDenied session={session} module="quote" />;

  const result = await getWorkbook(session, params.id);
  if (!result.ok) {
    if (result.status === 404) notFound();
    return <p className="text-sm text-red-600">{result.message}</p>;
  }
  const wb = result.data;
  const isTemplate = wb.kind === "TEMPLATE";
  const editScope = getScope(session, "quote", "edit");
  const canEdit = isTemplate ? canManageTemplates(session) : !!editScope && !wb.convertedQuoteId;

  const customerScope = getScope(session, "customer", "view");
  const [customers, quote] = await Promise.all([
    isTemplate
      ? Promise.resolve([])
      : withTenant(session.companyId, (tx) =>
          tx.customer.findMany({
            // Satış ("own") yalnızca kendi müşterilerini + belgenin mevcut müşterisini görür. DİKKAT: `{ id: undefined }`
            // Prisma'da "filtre yok" demektir — müşterisiz belgede herkesin müşterisi sızardı, koşullu kuruluyor.
            where: {
              deletedAt: null,
              ...(customerScope === "own"
                ? { OR: [{ ownerUserId: session.userId }, ...(wb.customerId ? [{ id: wb.customerId }] : [])] }
                : {}),
            },
            orderBy: { title: "asc" },
            select: { id: true, title: true, address: true, contacts: { where: { deletedAt: null }, orderBy: [{ isPrimary: "desc" }], take: 1, select: { phone: true, email: true } } },
          }),
        ),
    wb.convertedQuoteId ? withTenant(session.companyId, (tx) => tx.quote.findUnique({ where: { id: wb.convertedQuoteId! }, select: { id: true, number: true } })) : Promise.resolve(null),
  ]);

  return (
    <div>
      <Link href={isTemplate ? "/app/teklif-sablonlari" : "/app/teklif-sablonlari?tab=teklifler"} className="text-xs text-brand-700 hover:underline">
        ← {isTemplate ? "Teklif Şablonları" : "Hazırlanan teklifler"}
      </Link>
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-gray-800">{wb.name}</h1>
        <Badge color={isTemplate ? "violet" : "sky"}>{isTemplate ? "Şablon" : "Hazırlanan teklif"}</Badge>
        {quote && (
          <Link href={`/app/teklifler/${quote.id}`}>
            <Badge color="green">Satış teklifi {quote.number} →</Badge>
          </Link>
        )}
      </div>
      {wb.convertedQuoteId && <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">Bu belge satış teklifine dönüştürüldü; içerik kilitli. Excel olarak indirmeye devam edebilirsiniz.</p>}
      <WorkbookEditor
        kind={wb.kind}
        id={wb.id}
        initial={{ name: wb.name, description: wb.description ?? "", customerId: wb.customerId, content: wb.content, convertedQuoteId: wb.convertedQuoteId }}
        customers={customers.map((c) => ({ id: c.id, title: c.title, address: c.address, phone: c.contacts[0]?.phone ?? null, email: c.contacts[0]?.email ?? null }))}
        canEdit={canEdit}
        canExportInternal={!!editScope}
      />
    </div>
  );
}
