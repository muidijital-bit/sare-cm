import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { getQuote } from "@/lib/modules/quotes/service";
import { getRequiredScope } from "@/lib/auth/rbac";
import { tr, formatCurrencyTRY, formatDateTR } from "@/lib/i18n/tr";
import { Badge, QUOTE_STATUS_COLORS } from "@/components/ui/badge";
import { QuoteActions } from "../_components/quote-actions";

export default async function TeklifDetayPage({ params }: { params: { id: string } }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const result = await getQuote(session, params.id);
  if (!result.ok) return <p className="text-sm text-red-600">{result.message}</p>;
  const quote = result.data;

  const canEdit = !!getRequiredScope(session.role, "quote", "edit") && (getRequiredScope(session.role, "quote", "edit") === "all" || quote.ownerUserId === session.userId);
  const canConvert = !!getRequiredScope(session.role, "order", "create");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{quote.number}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge color={QUOTE_STATUS_COLORS[quote.status]}>{tr.quote.status[quote.status]}</Badge>
            <Link href={`/app/musteriler/${quote.customer.id}`} className="text-sm text-gray-600 hover:underline">
              {quote.customer.title}
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {quote.status === "DRAFT" && canEdit && (
            <Link href={`/app/teklifler/${quote.id}/duzenle`} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
              {tr.quote.edit}
            </Link>
          )}
          <QuoteActions quoteId={quote.id} status={quote.status} canEdit={canEdit} canConvert={canConvert} hasOrder={quote.orders.length > 0} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">{tr.document.description}</th>
                  <th className="px-3 py-2 text-right">{tr.document.quantity}</th>
                  <th className="px-3 py-2 text-right">{tr.document.unitPrice}</th>
                  <th className="px-3 py-2 text-right">{tr.document.vatRate}</th>
                  <th className="px-3 py-2 text-right">{tr.document.lineTotal}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quote.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2">{item.description}</td>
                    <td className="px-3 py-2 text-right">
                      {Number(item.quantity)} {item.unit}
                    </td>
                    <td className="px-3 py-2 text-right">{formatCurrencyTRY(Number(item.unitPrice))}</td>
                    <td className="px-3 py-2 text-right">%{Number(item.vatRate)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrencyTRY(Number(item.lineTotal))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {quote.note && (
            <div className="mt-4 rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-700">{quote.note}</div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">{tr.document.issueDate}</dt>
                <dd className="text-gray-900">{formatDateTR(new Date(quote.issueDate))}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">{tr.document.validUntil}</dt>
                <dd className="text-gray-900">{formatDateTR(new Date(quote.validUntil))}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">{tr.document.subtotal}</dt>
                <dd className="text-gray-900">{formatCurrencyTRY(Number(quote.subtotal))}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">{tr.document.discountTotal}</dt>
                <dd className="text-gray-900">-{formatCurrencyTRY(Number(quote.discountTotal))}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">{tr.document.vatTotal}</dt>
                <dd className="text-gray-900">{formatCurrencyTRY(Number(quote.vatTotal))}</dd>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold">
                <dt className="text-gray-900">{tr.document.grandTotal}</dt>
                <dd className="text-gray-900">{formatCurrencyTRY(Number(quote.grandTotal))}</dd>
              </div>
            </dl>
          </div>

          {quote.parentQuote && (
            <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
              <p className="text-gray-500">{tr.quote.revisionOf}</p>
              <Link href={`/app/teklifler/${quote.parentQuote.id}`} className="text-gray-900 hover:underline">
                {quote.parentQuote.number}
              </Link>
            </div>
          )}

          {quote.revisions.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
              <p className="mb-2 text-gray-500">{tr.quote.revisions}</p>
              <ul className="space-y-1">
                {quote.revisions.map((r) => (
                  <li key={r.id}>
                    <Link href={`/app/teklifler/${r.id}`} className="text-gray-900 hover:underline">
                      {r.number}
                    </Link>{" "}
                    <Badge color={QUOTE_STATUS_COLORS[r.status]}>{tr.quote.status[r.status]}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {quote.orders.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
              <p className="mb-2 text-gray-500">{tr.quote.linkedOrder}</p>
              {quote.orders.map((o) => (
                <Link key={o.id} href={`/app/siparisler/${o.id}`} className="text-gray-900 hover:underline">
                  {o.number}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
