import type { MembershipRole, Module } from "@/lib/auth/rbac";
import { getRequiredScope } from "@/lib/auth/rbac";

export interface NavItem {
  key: string;
  label: string;
  href: string;
  /** RBAC görünürlüğü buradan hesaplanır (bkz. §4 matrisi, rbac.ts). */
  module: Module | "dashboard";
  /** Sayfası henüz yapılmadıysa true — menüde "yakında" olarak, tıklanamaz gösterilir. */
  built: boolean;
}

/**
 * Sol menü öğeleri — modüller isterler dokümanındaki sırayla listelenir (§5).
 * Yeni bir modül inşa edildiğinde yalnızca ilgili satırın `built` alanı `true` yapılır;
 * menü yapısı/sırası ve rol görünürlüğü baştan doğru kurulmuştur.
 */
export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Panel", href: "/app", module: "dashboard", built: true },
  { key: "customers", label: "Müşteriler", href: "/app/musteriler", module: "customer", built: true },
  { key: "quotes", label: "Teklifler", href: "/app/teklifler", module: "quote", built: true },
  { key: "orders", label: "Siparişler", href: "/app/siparisler", module: "order", built: true },
  { key: "payments", label: "Tahsilatlar", href: "/app/tahsilatlar", module: "payment", built: true },
  { key: "expenses", label: "Giderler", href: "/app/giderler", module: "expense", built: true },
  { key: "audit", label: "İşlem Geçmişi", href: "/app/islem-gecmisi", module: "auditLog", built: true },
  { key: "users", label: "Kullanıcılar", href: "/app/kullanicilar", module: "userManagement", built: true },
  { key: "settings", label: "Şirket Ayarları", href: "/app/ayarlar", module: "companySettings", built: true },
];

/** Rol bu modülü hiç göremiyorsa (§4'te "—") menüde de hiç görünmez. */
export function isNavItemVisible(role: MembershipRole, item: NavItem): boolean {
  if (item.module === "dashboard") return true;
  return getRequiredScope(role, item.module, "view") !== null;
}
