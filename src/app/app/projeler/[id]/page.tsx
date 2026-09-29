import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/tenant-context";
import { getScope } from "@/lib/auth/access";
import { getProject } from "@/lib/modules/projects/service";
import { AccessDenied } from "@/components/ui/access-denied";
import { RowDeleteButton } from "@/components/ui/row-delete-button";
import { Badge, ORDER_STATUS_COLORS, PROJECT_STATUS_COLORS } from "@/components/ui/badge";
import { tr, formatCurrencyTRY, formatDateTR } from "@/lib/i18n/tr";
import { LaborEntryForm, MaterialEntryForm, ProjectDeleteButton } from "../_components/project-entry-forms";

/** Türkiye'de aylık yasal çalışma saati (45 saat × 5) — brüt maaştan saatlik maliyet önerisi için. */
const MONTHLY_WORK_HOURS = 225;

export default async function ProjeDetayPage({ params }: { params: { id: string } }) {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");

  if (!getScope(session, "project", "view")) return <AccessDenied session={session} module="project" />;

  const result = await getProject(session, params.id);
  if (!result.ok) {
    if (result.status === 404) notFound();
    return <p className="text-sm text-red-600">{result.message}</p>;
  }
  const { project: p, summary: s } = result.data;

  const canEdit = !!getScope(session, "project", "edit") && p.status !== "CANCELLED";
  const canDelete = !!getScope(session, "project", "delete");
  const canCreateOrder = !!getScope(session, "order", "create");
  const canViewExpense = !!getScope(session, "expense", "view");
  const canCreateExpense = !!getScope(session, "expense", "create");
  const canViewEmployees = !!getScope(session, "employee", "view");

  const [products, employees] = canEdit
    ? await Promise.all([
        withTenant(session.companyId, (tx) =>
          tx.product.findMany({ where: { deletedAt: null, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, unit: true, defaultCost: true, stockQty: true } }),
        ),
        canViewEmployees
          ? withTenant(session.companyId, (tx) =>
              tx.employee.findMany({ where: { deletedAt: null, status: "ACTIVE" }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true, grossSalary: true } }),
            )
          : Promise.resolve([]),
      ])
    : [[], []];

  const costParts = [
    { label: tr.project.summary.material, value: s.materialCost, color: "bg-violet-500" },
    { label: tr.project.summary.labor, value: s.laborCost, color: "bg-sky-500" },
    { label: tr.project.summary.expense, value: s.expenseCost, color: "bg-amber-500" },
    { label: tr.project.summary.orderLineCost, value: s.orderLineCost, color: "bg-fuchsia-500" },
  ];
  const profitPositive = s.profit >= 0;
  const zeroCostMaterials = p.materials.filter((m) => Number(m.unitCost) === 0).length;

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/app/projeler" className="text-xs text-brand-700 hover:underline">
            ← {tr.project.title}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{p.name}</h1>
            <Badge color={PROJECT_STATUS_COLORS[p.status]}>{tr.project.status[p.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {p.number} · {p.customer.title}
            {p.location && ` · ${p.location}`}
            {p.startDate && ` · ${formatDateTR(new Date(p.startDate))}`}
            {p.endDate && ` – ${formatDateTR(new Date(p.endDate))}`}
          </p>
        </div>
        <div className="flex gap-2">
          {!!getScope(session, "project", "edit") && (
            <Link href={`/app/projeler/${p.id}/duzenle`} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              {tr.project.edit}
            </Link>
          )}
          {canDelete && <ProjectDeleteButton projectId={p.id} />}
        </div>
      </div>

      {/* Özet kartları */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard label={tr.project.summary.contract} value={formatCurrencyTRY(s.contractAmount)} />
        <SummaryCard
          label={tr.project.summary.billed}
          value={formatCurrencyTRY(s.billed)}
          sub={`${tr.project.summary.remaining}: ${formatCurrencyTRY(s.remainingToBill)}`}
        />
        <SummaryCard
          label={tr.project.summary.collected}
          value={formatCurrencyTRY(s.collected)}
          sub={s.billed > 0 ? `Faturalananın %${Math.round((s.collected / s.billed) * 100)}'i` : undefined}
        />
        <div className={`rounded-2xl border p-5 shadow-theme-sm ${profitPositive ? "border-emerald-100 bg-emerald-50/60" : "border-rose-100 bg-rose-50/60"}`}>
          <p className="text-sm font-medium text-gray-500">{tr.project.summary.profit}</p>
          <p className={`mt-2 text-[24px] font-bold leading-tight tracking-tight ${profitPositive ? "text-emerald-700" : "text-rose-700"}`}>
            {formatCurrencyTRY(s.profit)}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            {tr.project.summary.margin}: {s.marginPct != null ? `%${s.marginPct.toFixed(1).replace(".", ",")}` : "—"}
          </p>
        </div>
      </div>

      {zeroCostMaterials > 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {zeroCostMaterials} malzeme kaydında birim maliyet 0 — kâr olduğundan yüksek görünüyor. Ürünlere maliyet girin veya kaydı maliyetiyle yeniden ekleyin.
        </p>
      )}

      {/* Maliyet dağılımı */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-theme-sm">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-[15px] font-semibold text-gray-900">{tr.project.summary.cost}</h3>
          <span className="text-lg font-bold text-gray-900">{formatCurrencyTRY(s.totalCost)}</span>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-gray-100">
          {s.totalCost > 0 &&
            costParts.map((c) => (c.value > 0 ? <div key={c.label} className={`${c.color} border-r-2 border-white last:border-r-0`} style={{ width: `${(c.value / s.totalCost) * 100}%` }} title={c.label} /> : null))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {costParts.map((c) => (
            <div key={c.label}>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className={`h-2 w-2 rounded-full ${c.color}`} />
                {c.label}
              </div>
              <p className="font-semibold text-gray-900">{formatCurrencyTRY(c.value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Malzemeler */}
      <Section title={tr.project.materials.title} hint={tr.project.materials.hint}>
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50 text-left text-theme-xs font-medium text-gray-500">
            <tr>
              <th className="px-4 py-2.5">{tr.project.materials.usedAt}</th>
              <th className="px-4 py-2.5">{tr.project.materials.product}</th>
              <th className="px-4 py-2.5 text-right">{tr.project.materials.quantity}</th>
              <th className="px-4 py-2.5 text-right">{tr.project.materials.unitCost}</th>
              <th className="px-4 py-2.5 text-right">Tutar</th>
              {canEdit && <th className="px-4 py-2.5" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {p.materials.length === 0 && <EmptyRow cols={canEdit ? 6 : 5} text={tr.project.materials.empty} />}
            {p.materials.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2.5 text-gray-600">{formatDateTR(new Date(m.usedAt))}</td>
                <td className="px-4 py-2.5 font-medium text-gray-900">{m.product.name}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">
                  {m.quantity.toString()} {m.product.unit}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-600">
                  {Number(m.unitCost) === 0 ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700" title="Üründe maliyet girilmemiş — kâr olduğundan yüksek görünür. Kaydı silip maliyetle yeniden ekleyin.">
                      maliyet yok
                    </span>
                  ) : (
                    formatCurrencyTRY(Number(m.unitCost))
                  )}
                </td>
                <td className="px-4 py-2.5 text-right font-medium text-gray-900">{formatCurrencyTRY(Number(m.unitCost) * Number(m.quantity))}</td>
                {canEdit && (
                  <td className="px-4 py-2.5 text-right">
                    <RowDeleteButton endpoint={`/api/projects/${p.id}/materials/${m.id}`} confirmMessage={tr.project.materials.deleteConfirm} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {canEdit && (
          <MaterialEntryForm
            projectId={p.id}
            products={products.map((x) => ({ id: x.id, name: x.name, unit: x.unit, defaultCost: x.defaultCost != null ? Number(x.defaultCost) : null, stockQty: Number(x.stockQty) }))}
          />
        )}
      </Section>

      {/* İşçilik */}
      <Section title={tr.project.labors.title} hint={s.totalHours > 0 ? `Toplam ${s.totalHours.toLocaleString("tr-TR")} saat` : undefined}>
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50 text-left text-theme-xs font-medium text-gray-500">
            <tr>
              <th className="px-4 py-2.5">{tr.project.labors.workDate}</th>
              <th className="px-4 py-2.5">{tr.project.labors.employee}</th>
              <th className="px-4 py-2.5">{tr.project.labors.description}</th>
              <th className="px-4 py-2.5 text-right">{tr.project.labors.hours}</th>
              <th className="px-4 py-2.5 text-right">{tr.project.labors.hourlyCost}</th>
              <th className="px-4 py-2.5 text-right">Tutar</th>
              {canEdit && <th className="px-4 py-2.5" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {p.labors.length === 0 && <EmptyRow cols={canEdit ? 7 : 6} text={tr.project.labors.empty} />}
            {p.labors.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2.5 text-gray-600">{formatDateTR(new Date(l.workDate))}</td>
                <td className="px-4 py-2.5 text-gray-900">{l.employee?.fullName ?? "—"}</td>
                <td className="px-4 py-2.5 text-gray-600">{l.description}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">{l.hours.toString()}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">{formatCurrencyTRY(Number(l.hourlyCost))}</td>
                <td className="px-4 py-2.5 text-right font-medium text-gray-900">{formatCurrencyTRY(Number(l.hourlyCost) * Number(l.hours))}</td>
                {canEdit && (
                  <td className="px-4 py-2.5 text-right">
                    <RowDeleteButton endpoint={`/api/projects/${p.id}/labors/${l.id}`} confirmMessage={tr.project.labors.deleteConfirm} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {canEdit && (
          <LaborEntryForm
            projectId={p.id}
            employees={employees.map((e) => ({ id: e.id, fullName: e.fullName, suggestedHourlyCost: Number(e.grossSalary) / MONTHLY_WORK_HOURS }))}
          />
        )}
      </Section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Hakediş / Siparişler */}
        <Section
          title={tr.project.orders.title}
          hint={tr.project.orders.hint}
          action={
            canCreateOrder && p.status !== "CANCELLED" ? (
              <Link href={`/app/siparisler/yeni?projectId=${p.id}`} className="rounded-lg bg-brand-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
                + {tr.project.orders.new}
              </Link>
            ) : undefined
          }
        >
          <ul className="divide-y divide-gray-100 text-sm">
            {p.orders.length === 0 && <li className="px-4 py-6 text-center text-gray-400">{tr.project.orders.empty}</li>}
            {p.orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <Link href={`/app/siparisler/${o.id}`} className="font-medium text-gray-900 hover:underline">
                    {o.number}
                  </Link>
                  <p className="text-xs text-gray-500">{formatDateTR(new Date(o.orderDate))}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge color={ORDER_STATUS_COLORS[o.status]}>{tr.order.status[o.status as keyof typeof tr.order.status]}</Badge>
                  <span className={`font-semibold ${o.status === "CANCELLED" ? "text-gray-400 line-through" : "text-gray-900"}`}>
                    {formatCurrencyTRY(Number(o.grandTotal) - Number(o.vatTotal))}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        {/* Giderler */}
        {canViewExpense && (
          <Section
            title={tr.project.expenses.title}
            hint={tr.project.expenses.hint}
            action={
              canCreateExpense && p.status !== "CANCELLED" ? (
                <Link href={`/app/giderler/yeni?projectId=${p.id}`} className="rounded-lg bg-brand-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
                  + {tr.project.expenses.new}
                </Link>
              ) : undefined
            }
          >
            <ul className="divide-y divide-gray-100 text-sm">
              {p.expenses.length === 0 && <li className="px-4 py-6 text-center text-gray-400">{tr.project.expenses.empty}</li>}
              {p.expenses.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <Link href={`/app/giderler/${e.id}/duzenle`} className="font-medium text-gray-900 hover:underline">
                      {e.category.name}
                      {e.vendor && <span className="font-normal text-gray-500"> · {e.vendor}</span>}
                    </Link>
                    <p className="text-xs text-gray-500">{formatDateTR(new Date(e.spentAt))}</p>
                  </div>
                  <span className="font-semibold text-gray-900">{formatCurrencyTRY(Number(e.amount))}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      {p.note && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 text-sm shadow-theme-sm">
          <p className="mb-1 text-gray-500">{tr.project.fields.note}</p>
          <p className="whitespace-pre-line text-gray-900">{p.note}</p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-theme-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-[24px] font-bold leading-tight tracking-tight text-gray-900">{value}</p>
      {sub && <p className="mt-2 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

function Section({ title, hint, action, children }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-theme-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
        <div>
          <h3 className="text-[15px] font-semibold text-gray-900">{title}</h3>
          {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
        </div>
        {action}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-6 text-center text-gray-400">
        {text}
      </td>
    </tr>
  );
}
