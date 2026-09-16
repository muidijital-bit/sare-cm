import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { getCustomer, getCustomerBalance } from "@/lib/modules/customers/service";
import { listQuotes } from "@/lib/modules/quotes/service";
import { listOrders } from "@/lib/modules/orders/service";
import { listPayments } from "@/lib/modules/payments/service";
import { getRequiredScope } from "@/lib/auth/rbac";
import { tr, formatDateTR, formatCurrencyTRY } from "@/lib/i18n/tr";
import { Badge, CUSTOMER_STATUS_COLORS, QUOTE_STATUS_COLORS, ORDER_STATUS_COLORS } from "@/components/ui/badge";
import { AuditTrail } from "@/components/audit/audit-trail";
import { DeleteCustomerButton } from "../_components/delete-customer-button";
import { ActivityForm } from "../_components/activity-form";

const TABS = [
  { key: "ozet", label: tr.customer.tabs.summary },
  { key: "gorusmeler", label: tr.customer.tabs.activities },
  { key: "teklifler", label: tr.customer.tabs.quotes },
  { key: "siparisler", label: tr.customer.tabs.orders },
  { key: "tahsilatlar", label: tr.customer.tabs.payments },
  { key: "ekler", label: tr.customer.tabs.attachments },
] as const;

export default async function MusteriDetayPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  const result = await getCustomer(session, params.id);
  if (!result.ok) {
    return <p className="text-sm text-red-600">{result.message}</p>;
  }
  const customer = result.data;

  const canEdit = !!getRequiredScope(session.role, "customer", "edit");
  const canDelete = !!getRequiredScope(session.role, "customer", "delete");
  const canViewAudit = !!getRequiredScope(session.role, "auditLog", "view");
  const activeTab = TABS.some((t) => t.key === searchParams.tab) ? searchParams.tab! : "ozet";

  const balanceResult = activeTab === "ozet" ? await getCustomerBalance(session, customer.id) : null;
  const quotesResult = activeTab === "teklifler" ? await listQuotes(session, { customerId: customer.id, page: 1, pageSize: 50 }) : null;
  const ordersResult = activeTab === "siparisler" ? await listOrders(session, { customerId: customer.id, page: 1, pageSize: 50 }) : null;
  const paymentsResult = activeTab === "tahsilatlar" ? await listPayments(session, { customerId: customer.id, page: 1, pageSize: 50 }) : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{customer.title}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge color={CUSTOMER_STATUS_COLORS[customer.status]}>{tr.customer.status[customer.status]}</Badge>
            <span className="text-xs text-gray-500">{tr.customer.type[customer.type]}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Link
              href={`/app/musteriler/${customer.id}/duzenle`}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {tr.customer.edit}
            </Link>
          )}
          {canDelete && <DeleteCustomerButton customerId={customer.id} />}
        </div>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-gray-200">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/app/musteriler/${customer.id}?tab=${t.key}`}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
              activeTab === t.key ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {activeTab === "ozet" && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Bilgiler</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">{tr.customer.fields.taxOffice}</dt>
                <dd className="text-gray-900">{customer.taxOffice || "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">{tr.customer.fields.taxNumber}</dt>
                <dd className="text-gray-900">{customer.taxNumber || "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">{tr.customer.fields.source}</dt>
                <dd className="text-gray-900">{customer.source?.name ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">{tr.customer.fields.address}</dt>
                <dd className="max-w-[60%] text-right text-gray-900">{customer.address || "—"}</dd>
              </div>
            </dl>

            <h2 className="mb-2 mt-4 text-sm font-semibold text-gray-900">{tr.customer.contacts.title}</h2>
            {customer.contacts.length === 0 && <p className="text-sm text-gray-400">—</p>}
            <ul className="space-y-2">
              {customer.contacts.map((c) => (
                <li key={c.id} className="text-sm">
                  <span className="font-medium text-gray-900">{c.name}</span>
                  {c.isPrimary && (
                    <span className="ml-1 text-xs text-gray-400">({tr.customer.contacts.primary})</span>
                  )}
                  <div className="text-xs text-gray-500">
                    {[c.position, c.phone, c.email].filter(Boolean).join(" · ") || "—"}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">MC-10 Bakiye Özeti</h2>
              {balanceResult?.ok ? (
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Toplam Sipariş</dt>
                    <dd className="text-gray-900">{formatCurrencyTRY(balanceResult.data.totalOrders)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Toplam Tahsilat</dt>
                    <dd className="text-green-700">{formatCurrencyTRY(balanceResult.data.totalPayments)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Açık Alacak</dt>
                    <dd className="text-gray-900">{formatCurrencyTRY(balanceResult.data.openReceivable)}</dd>
                  </div>
                  {balanceResult.data.overdue > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-red-600">Vadesi Geçmiş</dt>
                      <dd className="text-red-600">{formatCurrencyTRY(balanceResult.data.overdue)}</dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-gray-400">—</p>
              )}
            </div>

            {canViewAudit && <AuditTrail entityType="customer" entityId={customer.id} />}
          </div>
        </div>
      )}

      {activeTab === "gorusmeler" && (
        <div>
          {canEdit && (
            <ActivityForm
              customerId={customer.id}
              contacts={customer.contacts.map((c) => ({ id: c.id, name: c.name }))}
            />
          )}
          {customer.activities.length === 0 ? (
            <p className="text-sm text-gray-400">{tr.customer.activity.empty}</p>
          ) : (
            <ul className="space-y-3">
              {customer.activities.map((a) => (
                <li key={a.id} className="rounded-md border border-gray-200 bg-white p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{tr.customer.activityType[a.type]}</span>
                    <span className="text-xs text-gray-400">{formatDateTR(new Date(a.occurredAt))}</span>
                  </div>
                  {a.note && <p className="mt-1 text-gray-700">{a.note}</p>}
                  {a.nextAction && (
                    <p className="mt-1 text-xs text-amber-700">
                      Sonraki aksiyon: {a.nextAction}
                      {a.remindAt && ` · ${formatDateTR(new Date(a.remindAt))}`}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === "teklifler" && (
        <div className="space-y-2">
          {!quotesResult?.ok || quotesResult.data.items.length === 0 ? (
            <p className="text-sm text-gray-400">{tr.quote.empty}</p>
          ) : (
            quotesResult.data.items.map((q) => (
              <Link key={q.id} href={`/app/teklifler/${q.id}`} className="flex items-center justify-between rounded-md border border-gray-200 bg-white p-3 text-sm hover:bg-gray-50">
                <span className="font-medium text-gray-900">{q.number}</span>
                <Badge color={QUOTE_STATUS_COLORS[q.status]}>{tr.quote.status[q.status]}</Badge>
                <span className="text-gray-900">{formatCurrencyTRY(Number(q.grandTotal))}</span>
              </Link>
            ))
          )}
        </div>
      )}

      {activeTab === "siparisler" && (
        <div className="space-y-2">
          {!ordersResult?.ok || ordersResult.data.items.length === 0 ? (
            <p className="text-sm text-gray-400">{tr.order.empty}</p>
          ) : (
            ordersResult.data.items.map((o) => (
              <Link key={o.id} href={`/app/siparisler/${o.id}`} className="flex items-center justify-between rounded-md border border-gray-200 bg-white p-3 text-sm hover:bg-gray-50">
                <span className="font-medium text-gray-900">{o.number}</span>
                <Badge color={ORDER_STATUS_COLORS[o.status]}>{tr.order.status[o.status]}</Badge>
                <span className="text-gray-900">{formatCurrencyTRY(Number(o.grandTotal))}</span>
              </Link>
            ))
          )}
        </div>
      )}

      {activeTab === "tahsilatlar" && (
        <div className="space-y-2">
          {!paymentsResult?.ok || paymentsResult.data.items.length === 0 ? (
            <p className="text-sm text-gray-400">{tr.payment.empty}</p>
          ) : (
            paymentsResult.data.items.map((p) => (
              <Link key={p.id} href={`/app/tahsilatlar/${p.id}`} className="flex items-center justify-between rounded-md border border-gray-200 bg-white p-3 text-sm hover:bg-gray-50">
                <span className="text-gray-600">{formatDateTR(new Date(p.paidAt))}</span>
                <span className="text-gray-600">{tr.payment.method[p.method]}</span>
                <span className={Number(p.amount) < 0 ? "text-red-600" : "text-gray-900"}>{formatCurrencyTRY(Number(p.amount))}</span>
              </Link>
            ))
          )}
        </div>
      )}

      {activeTab === "ekler" && <p className="text-sm text-gray-400">{tr.customer.comingSoon}</p>}
    </div>
  );
}
