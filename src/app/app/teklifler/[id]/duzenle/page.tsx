import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { getQuote } from "@/lib/modules/quotes/service";
import { withTenant } from "@/lib/db/tenant-context";
import { getRequiredScope } from "@/lib/auth/rbac";
import { tr } from "@/lib/i18n/tr";
import { QuoteForm } from "../../_components/quote-form";

export default async function TeklifDuzenlePage({ params }: { params: { id: string } }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const scope = getRequiredScope(session.role, "quote", "edit");
  if (!scope) return <p className="text-sm text-gray-500">Bu kaydı düzenleme yetkiniz yok.</p>;

  const result = await getQuote(session, params.id);
  if (!result.ok) return <p className="text-sm text-red-600">{result.message}</p>;
  const quote = result.data;

  if (quote.status !== "DRAFT") {
    return <p className="text-sm text-amber-700">Yalnızca taslak durumundaki teklifler düzenlenebilir. Revizyon oluşturun.</p>;
  }

  const [customers, products, users] = await Promise.all([
    withTenant(session.companyId, (tx) =>
      tx.customer.findMany({
        where: { deletedAt: null, ...(scope === "own" ? { ownerUserId: session.userId } : {}) },
        orderBy: { title: "asc" },
        select: { id: true, title: true },
      }),
    ),
    withTenant(session.companyId, (tx) => tx.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })),
    scope === "all"
      ? withTenant(session.companyId, (tx) =>
          tx.membership.findMany({ where: { isActive: true }, include: { user: { select: { id: true, name: true } } }, orderBy: { user: { name: "asc" } } }),
        )
      : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-lg font-semibold text-gray-900">{tr.quote.edit}</h1>
      <QuoteForm
        mode="edit"
        quoteId={quote.id}
        initialValues={{
          customerId: quote.customerId,
          contactId: quote.contactId ?? "",
          issueDate: new Date(quote.issueDate).toISOString().slice(0, 10),
          validUntil: new Date(quote.validUntil).toISOString().slice(0, 10),
          ownerUserId: quote.ownerUserId,
          note: quote.note ?? "",
          documentDiscountType: quote.documentDiscountType ?? "PERCENT",
          documentDiscountValue: quote.documentDiscountValue ? String(quote.documentDiscountValue) : "0",
          items: quote.items.map((item) => ({
            id: item.id,
            productId: item.productId ?? "",
            description: item.description,
            quantity: String(item.quantity),
            unit: item.unit,
            unitPrice: String(item.unitPrice),
            unitCost: item.unitCost != null ? String(item.unitCost) : "",
            discountType: item.discountType,
            discountValue: String(item.discountValue),
            vatRate: String(item.vatRate),
          })),
        }}
        customers={customers}
        products={products.map((p) => ({ id: p.id, name: p.name, unit: p.unit, listPrice: Number(p.listPrice), vatRate: Number(p.vatRate), defaultCost: p.defaultCost != null ? Number(p.defaultCost) : null }))}
        users={users.map((m) => ({ id: m.user.id, name: m.user.name }))}
        canAssignOwner={scope === "all"}
      />
    </div>
  );
}
