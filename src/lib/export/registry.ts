import type { ZodTypeAny } from "zod";
import type { TenantSession } from "@/lib/auth/session";
import { getScope } from "@/lib/auth/access";
import type { Module } from "@/lib/auth/rbac";
import { tr } from "@/lib/i18n/tr";
import type { XlsxColumn } from "./xlsx";
import { listCustomers } from "@/lib/modules/customers/service";
import { listProducts } from "@/lib/modules/products/service";
import { listQuotes } from "@/lib/modules/quotes/service";
import { listOrders } from "@/lib/modules/orders/service";
import { listProjects } from "@/lib/modules/projects/service";
import { listPayments } from "@/lib/modules/payments/service";
import { listExpenses } from "@/lib/modules/expenses/service";
import { listTaxObligations } from "@/lib/modules/tax-obligations/service";
import { listSuppliers } from "@/lib/modules/suppliers/service";
import { listPurchaseOrders } from "@/lib/modules/purchase-orders/service";
import { listEmployees } from "@/lib/modules/employees/service";
import { listPayrollRuns } from "@/lib/modules/payroll/service";
import { listAuditLogs } from "@/lib/modules/audit/service";
import { listCompanyUsers } from "@/lib/modules/users/service";
import { listCustomersQuerySchema } from "@/lib/validation/customer";
import { listProductsQuerySchema } from "@/lib/validation/product";
import { listQuotesQuerySchema } from "@/lib/validation/quote";
import { listOrdersQuerySchema } from "@/lib/validation/order";
import { listProjectsQuerySchema } from "@/lib/validation/project";
import { listPaymentsQuerySchema } from "@/lib/validation/payment";
import { listExpensesQuerySchema } from "@/lib/validation/expense";
import { listTaxObligationsQuerySchema } from "@/lib/validation/tax-obligation";
import { listSuppliersQuerySchema } from "@/lib/validation/supplier";
import { listPurchaseOrdersQuerySchema } from "@/lib/validation/purchase-order";
import { listEmployeesQuerySchema } from "@/lib/validation/employee";
import { listPayrollRunsQuerySchema } from "@/lib/validation/payroll";
import { listAuditLogsQuerySchema } from "@/lib/validation/audit";

/**
 * Tüm gridlerin Excel dışa aktarma tanımları — TEK YER. Her giriş: yetki modülü, sayfanın
 * kullandığı AYNI liste şeması (filtreler birebir aynı yorumlanır), AYNI liste servisi (kapsam/RLS
 * dahil) ve sütunlar. Aktarma sayfadaki 20 satırla sınırlı DEĞİLDİR: filtreye uyan tüm kayıtlar
 * (en fazla MAX_ROWS) gider. Yeni bir grid eklenince buraya bir giriş eklenir.
 */
const MAX_ROWS = 10_000;

const n = (v: unknown) => (v == null ? null : Number(v));
const d = (v: Date | string | null | undefined) => (v ? new Date(v) : null);
const label = (dict: Record<string, string>, v: string | null | undefined) => (v ? dict[v] ?? v : null);

type Rows = { ok: true; data: { items: unknown[] } } | { ok: false; status: number; message: string };

interface ExportDef {
  module: Module;
  title: string;
  filename: string;
  schema?: ZodTypeAny;
  fetch: (session: TenantSession, params: Record<string, unknown>) => Promise<Rows>;
  columns: XlsxColumn<any>[];
}

const all = (params: Record<string, unknown>) => ({ ...params, page: 1, pageSize: MAX_ROWS });

export const EXPORTS: Record<string, ExportDef> = {
  musteriler: {
    module: "customer",
    title: "Müşteriler",
    filename: "musteriler",
    schema: listCustomersQuerySchema,
    fetch: (s, p) => listCustomers(s, all(p) as any) as Promise<Rows>,
    columns: [
      { header: "Müşteri", width: 34, value: (r: any) => r.title },
      { header: "Tür", value: (r: any) => label(tr.customer.type, r.type), width: 12 },
      { header: "Durum", value: (r: any) => label(tr.customer.status, r.status), width: 12 },
      { header: "Kaynak", value: (r: any) => r.source?.name, width: 16 },
      { header: "Etiketler", value: (r: any) => r.tags?.map((t: any) => t.tag.name).join(", "), width: 22 },
      { header: "Vergi Dairesi", value: (r: any) => r.taxOffice, width: 18 },
      { header: "Vergi No / TCKN", value: (r: any) => r.taxNumber, width: 16 },
      { header: "Adres", value: (r: any) => r.address, width: 40 },
      { header: "Kayıt Tarihi", type: "date", value: (r: any) => d(r.createdAt) },
    ],
  },
  urunler: {
    module: "product",
    title: "Ürünler",
    filename: "urunler",
    schema: listProductsQuerySchema,
    fetch: (s, p) => listProducts(s, all(p) as any) as Promise<Rows>,
    columns: [
      { header: "Ürün", width: 34, value: (r: any) => r.name },
      { header: "Kod", value: (r: any) => r.code, width: 14 },
      { header: "Birim", value: (r: any) => r.unit, width: 8 },
      { header: "Liste Fiyatı", type: "currency", total: false, value: (r: any) => n(r.listPrice) },
      { header: "Maliyet", type: "currency", total: false, value: (r: any) => n(r.defaultCost) },
      { header: "KDV %", type: "number", value: (r: any) => n(r.vatRate), width: 8 },
      { header: "Stok", type: "number", value: (r: any) => n(r.stockQty) },
      { header: "Varsayılan Tedarikçi", value: (r: any) => r.defaultSupplier?.title, width: 26 },
      { header: "Durum", value: (r: any) => (r.isActive ? "Aktif" : "Pasif"), width: 10 },
    ],
  },
  stok: {
    module: "supplier",
    title: "Stok Durumu",
    filename: "stok",
    schema: listProductsQuerySchema,
    fetch: (s, p) => listProducts(s, all({ active: "true", ...p }) as any) as Promise<Rows>,
    columns: [
      { header: "Ürün", width: 34, value: (r: any) => r.name },
      { header: "Kod", value: (r: any) => r.code, width: 14 },
      { header: "Stok", type: "number", value: (r: any) => n(r.stockQty) },
      { header: "Birim", value: (r: any) => r.unit, width: 8 },
      { header: "Birim Maliyet", type: "currency", total: false, value: (r: any) => n(r.defaultCost) },
      { header: "Stok Değeri", type: "currency", value: (r: any) => (r.defaultCost != null ? Number(r.defaultCost) * Number(r.stockQty) : null) },
      { header: "Varsayılan Tedarikçi", value: (r: any) => r.defaultSupplier?.title, width: 26 },
    ],
  },
  teklifler: {
    module: "quote",
    title: "Teklifler",
    filename: "teklifler",
    schema: listQuotesQuerySchema,
    fetch: (s, p) => listQuotes(s, all(p) as any) as Promise<Rows>,
    columns: [
      { header: "Teklif No", value: (r: any) => r.number, width: 18 },
      { header: "Müşteri", value: (r: any) => r.customer?.title, width: 32 },
      { header: "Tarih", type: "date", value: (r: any) => d(r.issueDate) },
      { header: "Geçerlilik", type: "date", value: (r: any) => d(r.validUntil) },
      { header: "Durum", value: (r: any) => label(tr.quote.status, r.status), width: 14 },
      { header: "Ara Toplam", type: "currency", value: (r: any) => n(r.subtotal) },
      { header: "İndirim", type: "currency", value: (r: any) => n(r.discountTotal) },
      { header: "KDV", type: "currency", value: (r: any) => n(r.vatTotal) },
      { header: "Genel Toplam", type: "currency", value: (r: any) => n(r.grandTotal) },
    ],
  },
  siparisler: {
    module: "order",
    title: "Siparişler",
    filename: "siparisler",
    schema: listOrdersQuerySchema,
    fetch: (s, p) => listOrders(s, all(p) as any) as Promise<Rows>,
    columns: [
      { header: "Sipariş No", value: (r: any) => r.number, width: 18 },
      { header: "Müşteri", value: (r: any) => r.customer?.title, width: 32 },
      { header: "Tarih", type: "date", value: (r: any) => d(r.orderDate) },
      { header: "Vade", type: "date", value: (r: any) => d(r.dueDate) },
      { header: "Durum", value: (r: any) => label(tr.order.status, r.status), width: 14 },
      { header: "KDV Hariç", type: "currency", value: (r: any) => Number(r.grandTotal) - Number(r.vatTotal) },
      { header: "KDV", type: "currency", value: (r: any) => n(r.vatTotal) },
      { header: "Genel Toplam", type: "currency", value: (r: any) => n(r.grandTotal) },
    ],
  },
  projeler: {
    module: "project",
    title: "Projeler",
    filename: "projeler",
    schema: listProjectsQuerySchema,
    fetch: (s, p) => listProjects(s, all(p) as any) as Promise<Rows>,
    columns: [
      { header: "Proje No", value: (r: any) => r.number, width: 16 },
      { header: "Proje", value: (r: any) => r.name, width: 34 },
      { header: "Müşteri", value: (r: any) => r.customer?.title, width: 28 },
      { header: "Konum", value: (r: any) => r.location, width: 22 },
      { header: "Durum", value: (r: any) => label(tr.project.status, r.status), width: 14 },
      { header: "Başlangıç", type: "date", value: (r: any) => d(r.startDate) },
      { header: "Bitiş", type: "date", value: (r: any) => d(r.endDate) },
      { header: "Sözleşme Bedeli", type: "currency", value: (r: any) => n(r.contractAmount) },
    ],
  },
  tahsilatlar: {
    module: "payment",
    title: "Tahsilatlar",
    filename: "tahsilatlar",
    schema: listPaymentsQuerySchema,
    fetch: (s, p) => listPayments(s, all(p) as any) as Promise<Rows>,
    columns: [
      { header: "Tarih", type: "date", value: (r: any) => d(r.paidAt) },
      { header: "Müşteri", value: (r: any) => r.customer?.title, width: 32 },
      { header: "Yöntem", value: (r: any) => label(tr.payment.method, r.method), width: 14 },
      { header: "Hesap", value: (r: any) => r.account?.name, width: 18 },
      // İptal edilen tahsilat toplama girmesin diye "Tutar" 0; gerçek tutar ayrı sütunda (toplamsız).
      { header: "Tutar", type: "currency", value: (r: any) => (r.isCancelled ? 0 : n(r.amount)) },
      { header: "Orijinal Tutar", type: "currency", total: false, value: (r: any) => n(r.amount) },
      { header: "Durum", value: (r: any) => (r.isCancelled ? "İptal edildi" : "Aktif"), width: 12 },
      { header: "Referans", value: (r: any) => r.reference, width: 18 },
      { header: "Not", value: (r: any) => r.note, width: 30 },
    ],
  },
  giderler: {
    module: "expense",
    title: "Giderler",
    filename: "giderler",
    schema: listExpensesQuerySchema,
    fetch: (s, p) => listExpenses(s, all(p) as any) as Promise<Rows>,
    columns: [
      { header: "Tarih", type: "date", value: (r: any) => d(r.spentAt) },
      { header: "Kategori", value: (r: any) => r.category?.name, width: 20 },
      { header: "Tedarikçi / Firma", value: (r: any) => r.vendor, width: 26 },
      { header: "Hesap", value: (r: any) => r.account?.name, width: 16 },
      { header: "Tutar", type: "currency", value: (r: any) => n(r.amount) },
      { header: "KDV", type: "currency", value: (r: any) => n(r.vatAmount) },
      { header: "Not", value: (r: any) => r.note, width: 30 },
    ],
  },
  "vergi-sgk": {
    module: "taxObligation",
    title: "Vergi & SGK Yükümlülükleri",
    filename: "vergi-sgk",
    schema: listTaxObligationsQuerySchema,
    fetch: (s, p) => listTaxObligations(s, all(p) as any) as Promise<Rows>,
    columns: [
      { header: "Tür", value: (r: any) => label(tr.taxObligation.type, r.type), width: 22 },
      { header: "Dönem", value: (r: any) => r.period, width: 10 },
      { header: "Son Ödeme", type: "date", value: (r: any) => d(r.dueDate) },
      { header: "Tutar", type: "currency", value: (r: any) => n(r.amount) },
      { header: "Ödenen", type: "currency", value: (r: any) => n(r.paidAmount) },
      { header: "Ödeme Tarihi", type: "date", value: (r: any) => d(r.paidAt) },
      { header: "Durum", value: (r: any) => label(tr.taxObligation.status, r.status), width: 12 },
      { header: "Not", value: (r: any) => r.note, width: 30 },
    ],
  },
  tedarikciler: {
    module: "supplier",
    title: "Tedarikçiler",
    filename: "tedarikciler",
    schema: listSuppliersQuerySchema,
    fetch: (s, p) => listSuppliers(s, all(p) as any) as Promise<Rows>,
    columns: [
      { header: "Tedarikçi", value: (r: any) => r.title, width: 34 },
      { header: "Vergi Dairesi", value: (r: any) => r.taxOffice, width: 18 },
      { header: "Vergi No", value: (r: any) => r.taxNumber, width: 14 },
      { header: "Telefon", value: (r: any) => r.phone, width: 16 },
      { header: "E-posta", value: (r: any) => r.email, width: 26 },
      { header: "Adres", value: (r: any) => r.address, width: 40 },
      { header: "Durum", value: (r: any) => (r.isActive ? "Aktif" : "Pasif"), width: 10 },
    ],
  },
  "satin-almalar": {
    module: "supplier",
    title: "Satın Almalar",
    filename: "satin-almalar",
    schema: listPurchaseOrdersQuerySchema,
    fetch: (s, p) => listPurchaseOrders(s, all(p) as any) as Promise<Rows>,
    columns: [
      { header: "No", value: (r: any) => r.number, width: 16 },
      { header: "Tedarikçi", value: (r: any) => r.supplier?.title, width: 30 },
      { header: "Sipariş Tarihi", type: "date", value: (r: any) => d(r.orderedAt) },
      { header: "Teslim Tarihi", type: "date", value: (r: any) => d(r.receivedAt) },
      { header: "Durum", value: (r: any) => label(tr.purchaseOrder.status, r.status), width: 14 },
      { header: "Ara Toplam", type: "currency", value: (r: any) => n(r.subtotal) },
      { header: "KDV", type: "currency", value: (r: any) => n(r.vatTotal) },
      { header: "Toplam", type: "currency", value: (r: any) => n(r.total) },
    ],
  },
  personel: {
    module: "employee",
    title: "Personel",
    filename: "personel",
    schema: listEmployeesQuerySchema,
    fetch: (s, p) => listEmployees(s, all(p) as any) as Promise<Rows>,
    columns: [
      { header: "Ad Soyad", value: (r: any) => r.fullName, width: 26 },
      { header: "Pozisyon", value: (r: any) => r.position, width: 20 },
      { header: "Departman", value: (r: any) => r.department, width: 18 },
      { header: "İşe Giriş", type: "date", value: (r: any) => d(r.hireDate) },
      { header: "Çıkış", type: "date", value: (r: any) => d(r.terminationDate) },
      { header: "Brüt Maaş", type: "currency", value: (r: any) => n(r.grossSalary) },
      { header: "Durum", value: (r: any) => label(tr.employee.status, r.status), width: 14 },
      { header: "Telefon", value: (r: any) => r.phone, width: 16 },
      { header: "E-posta", value: (r: any) => r.email, width: 24 },
    ],
  },
  bordro: {
    module: "payroll",
    title: "Bordro Dönemleri",
    filename: "bordro",
    schema: listPayrollRunsQuerySchema,
    fetch: (s, p) => listPayrollRuns(s, all(p) as any) as Promise<Rows>,
    columns: [
      { header: "Dönem", value: (r: any) => r.period, width: 12 },
      { header: "Durum", value: (r: any) => label(tr.payroll.status, r.status), width: 14 },
      { header: "Toplam Brüt", type: "currency", value: (r: any) => n(r.totalGross) },
      { header: "Toplam Net", type: "currency", value: (r: any) => n(r.totalNet) },
      { header: "İşveren Maliyeti", type: "currency", value: (r: any) => n(r.totalEmployerCost) },
      { header: "Ödeme Tarihi", type: "date", value: (r: any) => d(r.paidAt) },
    ],
  },
  "islem-gecmisi": {
    module: "auditLog",
    title: "İşlem Geçmişi",
    filename: "islem-gecmisi",
    schema: listAuditLogsQuerySchema,
    fetch: (s, p) => listAuditLogs(s, all(p) as any) as Promise<Rows>,
    columns: [
      { header: "Tarih", type: "date", value: (r: any) => d(r.createdAt) },
      { header: "Kullanıcı", value: (r: any) => r.userName ?? r.userEmail, width: 22 },
      { header: "İşlem", value: (r: any) => label(tr.audit.action as Record<string, string>, r.action), width: 16 },
      { header: "Kayıt Türü", value: (r: any) => label(tr.audit.entityType as Record<string, string>, r.entityType), width: 18 },
      { header: "Değişiklik", value: (r: any) => (r.changes ? JSON.stringify(r.changes) : null), width: 60 },
    ],
  },
  kullanicilar: {
    module: "userManagement",
    title: "Kullanıcılar",
    filename: "kullanicilar",
    fetch: async (s) => {
      const res = await listCompanyUsers(s);
      return res.ok ? { ok: true, data: { items: res.data } } : res;
    },
    columns: [
      { header: "Ad Soyad", value: (r: any) => r.name, width: 24 },
      { header: "E-posta", value: (r: any) => r.email, width: 30 },
      { header: "Rol", value: (r: any) => label(tr.users.roleLabels, r.role), width: 14 },
      { header: "Durum", value: (r: any) => r.statusLabel ?? (r.isActive === false ? "Pasif" : r.kind === "invitation" ? "Davet bekliyor" : "Aktif"), width: 16 },
    ],
  },
};

/** Dışa aktarma ayrı bir yetkidir (bkz. rbac.ts "export") — görüntüleme yetkisi yetmez. */
export function canExport(session: TenantSession, key: string): boolean {
  const def = EXPORTS[key];
  return !!def && !!getScope(session, def.module, "export");
}

/** Sayfalar için: yetki varsa grid anahtarını, yoksa undefined döner (Excel düğmesi gizlenir). */
export function exportKeyFor(session: TenantSession, key: string): string | undefined {
  return canExport(session, key) ? key : undefined;
}
