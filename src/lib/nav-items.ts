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
} from "react-feather";
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
  /** react-feather SVG ikonu — sol menüde etiketin yanına çizilir. */
  icon: ComponentType<{ size?: number | string; className?: string }>;
  /** Pasif durumdaki ikon rengi (Tailwind metin rengi sınıfı) — her modül kendi tonuyla ayrışır;
   *  aktif/hover durumunda tutarlılık için tek marka rengine (brand-600) döner. */
  accentClass: string;
}

/**
 * Sol menü öğeleri — modüller isterler dokümanındaki sırayla listelenir (§5).
 * Yeni bir modül inşa edildiğinde yalnızca ilgili satırın `built` alanı `true` yapılır;
 * menü yapısı/sırası ve rol görünürlüğü baştan doğru kurulmuştur.
 */
export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Panel", href: "/app", module: "dashboard", built: true, icon: Home, accentClass: "text-sky-300" },
  { key: "customers", label: "Müşteriler", href: "/app/musteriler", module: "customer", built: true, icon: Users, accentClass: "text-cyan-300" },
  { key: "quotes", label: "Teklifler", href: "/app/teklifler", module: "quote", built: true, icon: FileText, accentClass: "text-amber-300" },
  { key: "orders", label: "Siparişler", href: "/app/siparisler", module: "order", built: true, icon: ShoppingBag, accentClass: "text-violet-300" },
  { key: "payments", label: "Tahsilatlar", href: "/app/tahsilatlar", module: "payment", built: true, icon: DollarSign, accentClass: "text-emerald-300" },
  { key: "expenses", label: "Giderler", href: "/app/giderler", module: "expense", built: true, icon: TrendingDown, accentClass: "text-rose-300" },
  { key: "audit", label: "İşlem Geçmişi", href: "/app/islem-gecmisi", module: "auditLog", built: true, icon: Clock, accentClass: "text-slate-300" },
  { key: "users", label: "Kullanıcılar", href: "/app/kullanicilar", module: "userManagement", built: true, icon: UserPlus, accentClass: "text-indigo-300" },
  { key: "settings", label: "Şirket Ayarları", href: "/app/ayarlar", module: "companySettings", built: true, icon: Settings, accentClass: "text-gray-300" },
];

/** Rol bu modülü hiç göremiyorsa (§4'te "—") menüde de hiç görünmez. */
export function isNavItemVisible(role: MembershipRole, item: NavItem): boolean {
  if (item.module === "dashboard") return true;
  return getRequiredScope(role, item.module, "view") !== null;
}
