import type { ComponentType } from "react";
import {
  Home,
  Users,
  FileText,
  ShoppingBag,
  DollarSign,
  TrendingDown,
  Clock,
  UserPlus,
  Settings,
  Truck,
  Package,
  Briefcase,
  CreditCard,
  Percent,
  Box,
  Archive,
} from "react-feather";
import type { MembershipRole, Module } from "@/lib/auth/rbac";
import { getRequiredScope } from "@/lib/auth/rbac";
import { isModuleEnabled } from "@/lib/modules/entitlements/resolve";

/**
 * Menü grupları — sidebar artık kategori başlıklarıyla bölümlenir (kullanıcı geri
 * bildirimi: "menüleri gruplandır ve kategori başlıkları olsun"). Sıra burada tanımlı.
 */
export type NavGroupKey = "overview" | "sales" | "finance" | "supply" | "hr" | "admin";

export const NAV_GROUPS: { key: NavGroupKey; label: string }[] = [
  { key: "overview", label: "Genel Bakış" },
  { key: "sales", label: "Satış" },
  { key: "finance", label: "Finans" },
  { key: "supply", label: "Tedarik & Stok" },
  { key: "hr", label: "İnsan Kaynakları" },
  { key: "admin", label: "Yönetim" },
];

export interface NavItem {
  key: string;
  label: string;
  href: string;
  group: NavGroupKey;
  /** RBAC görünürlüğü buradan hesaplanır (bkz. §4 matrisi, rbac.ts). */
  module: Module | "dashboard";
  /** Sayfası henüz yapılmadıysa true — menüde "yakında" olarak, tıklanamaz gösterilir. */
  built: boolean;
  /** react-feather SVG ikonu — sol menüde etiketin yanına çizilir. */
  icon: ComponentType<{ size?: number | string; className?: string }>;
}

/**
 * Sol menü öğeleri — gruplar içinde isterler dokümanındaki sırayla listelenir (§5).
 * Yeni bir modül inşa edildiğinde yalnızca ilgili satırın `built` alanı `true` yapılır;
 * menü yapısı/sırası ve rol görünürlüğü baştan doğru kurulmuştur.
 *
 * Renk artık öğe başına DEĞİL — sidebar mor/indigo gradyan bir zemine oturduğu için tüm
 * ikonlar tek tip (beyaz/açık) render edilir, aksi "her modül kendi neon rengi" karışıklığı
 * yaratıyordu (kullanıcı geri bildirimi). Bkz. app-shell.tsx.
 */
export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Panel", href: "/app", group: "overview", module: "dashboard", built: true, icon: Home },

  { key: "customers", label: "Müşteriler", href: "/app/musteriler", group: "sales", module: "customer", built: true, icon: Users },
  { key: "products", label: "Ürünler", href: "/app/urunler", group: "sales", module: "product", built: true, icon: Box },
  { key: "quotes", label: "Teklifler", href: "/app/teklifler", group: "sales", module: "quote", built: true, icon: FileText },
  { key: "orders", label: "Siparişler", href: "/app/siparisler", group: "sales", module: "order", built: true, icon: ShoppingBag },

  { key: "payments", label: "Tahsilatlar", href: "/app/tahsilatlar", group: "finance", module: "payment", built: true, icon: DollarSign },
  { key: "expenses", label: "Giderler", href: "/app/giderler", group: "finance", module: "expense", built: true, icon: TrendingDown },
  { key: "taxObligations", label: "Vergi & SGK", href: "/app/vergi-sgk", group: "finance", module: "taxObligation", built: true, icon: Percent },

  { key: "suppliers", label: "Tedarikçiler", href: "/app/tedarikciler", group: "supply", module: "supplier", built: true, icon: Truck },
  { key: "purchaseOrders", label: "Satın Almalar", href: "/app/satin-almalar", group: "supply", module: "supplier", built: true, icon: Package },
  { key: "stock", label: "Stok", href: "/app/satin-almalar/stok", group: "supply", module: "supplier", built: true, icon: Archive },

  { key: "employees", label: "Personel", href: "/app/personel", group: "hr", module: "employee", built: true, icon: Briefcase },
  { key: "payroll", label: "Bordro", href: "/app/bordro", group: "hr", module: "payroll", built: true, icon: CreditCard },

  { key: "audit", label: "İşlem Geçmişi", href: "/app/islem-gecmisi", group: "admin", module: "auditLog", built: true, icon: Clock },
  { key: "users", label: "Kullanıcılar", href: "/app/kullanicilar", group: "admin", module: "userManagement", built: true, icon: UserPlus },
  { key: "settings", label: "Şirket Ayarları", href: "/app/ayarlar", group: "admin", module: "companySettings", built: true, icon: Settings },
];

/** Mobil alt sekme çubuğunda gösterilecek "en önemli" modüller — sırayla ilk N görünür öğe. */
export const MOBILE_PRIMARY_COUNT = 5;

/** Rol bu modülü hiç göremiyorsa (§4'te "—") VEYA modül şirketin lisansında yoksa menüde görünmez. */
export function isNavItemVisible(role: MembershipRole, item: NavItem, enabledModules: readonly string[]): boolean {
  if (!isModuleEnabled(enabledModules, item.module)) return false;
  if (item.module === "dashboard") return true;
  return getRequiredScope(role, item.module, "view") !== null;
}
