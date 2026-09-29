/**
 * Rol × Yetki matrisi — bkz. docs/v1-isterler-dokumani.md §4.
 *
 * Tek kaynak burasıdır: yeni bir modül/route eklerken yetki kontrolü buradan genişletilir,
 * route içine ad-hoc if/else yazılmaz (bkz. .claude/agents/auth-tenant-security.md).
 *
 * "own" kapsamı, kayda atanmış `ownerUserId` alanına göre değerlendirilir (bkz. §4).
 */

export type MembershipRole = "OWNER" | "ADMIN" | "SALES" | "ACCOUNTING" | "VIEWER";

export type Action = "view" | "create" | "edit" | "delete" | "export";

export type Scope = "all" | "own";

export type Module =
  | "companySettings"
  | "userManagement"
  | "customer"
  | "quote"
  | "order"
  | "payment"
  | "expense"
  | "auditLog"
  | "supplier"
  | "employee"
  | "payroll"
  | "taxObligation"
  | "product"
  | "project";

/** Bir modül için: her eylemin hangi kapsamda (`all`/`own`) izinli olduğu. Eylem yoksa yasak. */
type ModuleRule = Partial<Record<Action, Scope>>;

type Matrix = Record<Module, Record<MembershipRole, ModuleRule>>;

const FULL: ModuleRule = { view: "all", create: "all", edit: "all", delete: "all", export: "all" };
const VIEW_ONLY: ModuleRule = { view: "all" };
const NONE: ModuleRule = {};

/**
 * §4'teki tablonun birebir kod karşılığı. Yeni bir hücre eklerken önce isterler
 * dokümanındaki tabloyu güncelle, sonra burayı senkronla.
 */
export const PERMISSION_MATRIX: Matrix = {
  companySettings: {
    OWNER: FULL,
    ADMIN: FULL,
    SALES: NONE,
    ACCOUNTING: NONE,
    VIEWER: NONE,
  },
  userManagement: {
    OWNER: FULL,
    ADMIN: { view: "all", create: "all", edit: "all" }, // Ekle/Düzenle — silme yok
    SALES: NONE,
    ACCOUNTING: NONE,
    VIEWER: NONE,
  },
  customer: {
    OWNER: FULL,
    ADMIN: FULL,
    SALES: { view: "own", create: "own", edit: "own", delete: "own", export: "own" }, // Tam (kendi)
    ACCOUNTING: VIEW_ONLY,
    VIEWER: VIEW_ONLY,
  },
  quote: {
    OWNER: FULL,
    ADMIN: FULL,
    SALES: { view: "own", create: "own", edit: "own", delete: "own", export: "own" },
    ACCOUNTING: VIEW_ONLY,
    VIEWER: VIEW_ONLY,
  },
  order: {
    OWNER: FULL,
    ADMIN: FULL,
    SALES: { view: "own", create: "own", edit: "own" }, // Ekle/Düzenle (kendi) — silme yok
    ACCOUNTING: VIEW_ONLY,
    VIEWER: VIEW_ONLY,
  },
  payment: {
    OWNER: FULL,
    ADMIN: FULL,
    SALES: VIEW_ONLY,
    ACCOUNTING: FULL,
    VIEWER: VIEW_ONLY,
  },
  expense: {
    OWNER: FULL,
    ADMIN: FULL,
    SALES: NONE,
    ACCOUNTING: FULL,
    VIEWER: NONE,
  },
  auditLog: {
    OWNER: FULL,
    ADMIN: VIEW_ONLY,
    SALES: NONE,
    ACCOUNTING: NONE,
    VIEWER: NONE,
  },
  // Tedarikçi/satın alma/stok: mali nitelikli — expense ile aynı desen (satış rolü göremez).
  supplier: {
    OWNER: FULL,
    ADMIN: FULL,
    SALES: NONE,
    ACCOUNTING: FULL,
    VIEWER: NONE,
  },
  // Personel: kişisel veri (TC kimlik no vb.) içerir — muhasebe yalnızca GÖRÜNTÜLER (bordro için),
  // düzenleyemez; satış ve salt izleyici hiç göremez.
  employee: {
    OWNER: FULL,
    ADMIN: FULL,
    SALES: NONE,
    ACCOUNTING: VIEW_ONLY,
    VIEWER: NONE,
  },
  // Bordro/Vergi & SGK: mali nitelikli — expense/supplier ile aynı desen.
  payroll: {
    OWNER: FULL,
    ADMIN: FULL,
    SALES: NONE,
    ACCOUNTING: FULL,
    VIEWER: NONE,
  },
  taxObligation: {
    OWNER: FULL,
    ADMIN: FULL,
    SALES: NONE,
    ACCOUNTING: FULL,
    VIEWER: NONE,
  },
  // Ürün kataloğu: teklif/sipariş için ÇEKİRDEK altyapı (bkz. catalog.ts isCore:true) —
  // satış/muhasebe/izleyici fiyat ve maliyeti görebilir ama yalnızca yönetici düzenler.
  product: {
    OWNER: FULL,
    ADMIN: FULL,
    SALES: VIEW_ONLY,
    ACCOUNTING: VIEW_ONLY,
    VIEWER: VIEW_ONLY,
  },
  // Projeler (iş/inşaat): satış kendi projelerini yönetir (sipariş ile aynı desen, silme yok);
  // muhasebe maliyet/işçilik girer; izleyici yalnızca görür.
  project: {
    OWNER: FULL,
    ADMIN: FULL,
    SALES: { view: "own", create: "own", edit: "own" },
    ACCOUNTING: { view: "all", edit: "all", export: "all" },
    VIEWER: VIEW_ONLY,
  },
};

/** Dashboard §4/§5.9'da CRUD'dan farklı, kendine özgü bir görünürlük kuralı izler. */
export type DashboardVisibility = "full" | "ownOnly" | "financial";

export const DASHBOARD_VISIBILITY: Record<MembershipRole, DashboardVisibility> = {
  OWNER: "full",
  ADMIN: "full",
  SALES: "ownOnly", // yalnız kendi rakamları
  ACCOUNTING: "financial",
  VIEWER: "ownOnly", // "Kısıtlı"
};

/**
 * Bir eylem için gereken kapsamı döner; eylem yasaksa null.
 * `record`in owner'ı çağıran kullanıcı değilse ve kapsam "own" ise, çağıran taraf
 * (route/servis) ayrıca `record.ownerUserId === session.userId` kontrolünü yapmalıdır —
 * bu fonksiyon yalnızca ROL bazlı izni söyler, kayıt bazlı sahiplik kontrolü değildir.
 */
export function getRequiredScope(role: MembershipRole, module: Module, action: Action): Scope | null {
  return PERMISSION_MATRIX[module]?.[role]?.[action] ?? null;
}

/**
 * Merkezi yetki kontrolü. `ownerUserId` verilirse ve kapsam "own" ise sahiplik doğrulanır.
 *
 * @example
 *   if (!can(membership.role, "customer", "edit", { ownerUserId: customer.ownerUserId, userId })) {
 *     return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
 *   }
 */
export function can(
  role: MembershipRole,
  module: Module,
  action: Action,
  ctx?: { ownerUserId?: string | null; userId?: string },
): boolean {
  const scope = getRequiredScope(role, module, action);
  if (!scope) return false;
  if (scope === "all") return true;
  // scope === "own"
  if (!ctx?.userId) return false;
  return ctx.ownerUserId === ctx.userId;
}

/** Şirkette son Sahip'in silinmesini/rolünün düşürülmesini engellemek için kullanılır (§4). */
export function isLastOwnerGuardRequired(role: MembershipRole): boolean {
  return role === "OWNER";
}
