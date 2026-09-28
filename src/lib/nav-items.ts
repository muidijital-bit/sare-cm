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
} from "react-feather";
import type { MembershipRole, Module } from "@/lib/auth/rbac";
import { getRequiredScope } from "@/lib/auth/rbac";
import { isModuleEnabled } from "@/lib/modules/entitlements/resolve";

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
  /** Pasif durumdaki ikon rengi (Tailwind metin rengi sınıfı) — her modül kendi tonuyla ayrışır. */
  accentClass: string;
  /**
   * Aktif durumda kullanılan yumuşak renk tonu (arka plan/kenar/metin) — Tailwind JIT
   * dinamik sınıf üretemediğinden (bkz. dashboard CARD_COLOR_CHIP deneyimi) bu sınıflar
   * burada LİTERAL string olarak tanımlanır, template literal ile inşa EDİLMEZ.
   */
  activeBg: string;
  activeText: string;
  /** Seçili öğenin ikonu: doygun ton + ikonun arkasında yarı saydam renkli zemin (literal — JIT). */
  activeIcon: string;
  activeIconBg: string;
  /**
   * Seçili öğenin solundaki düz, fosforlu çizgi — köşeleri yuvarlamayan ayrı bir bar
   * (parent'ın rounded-lg'sinden bağımsız), tam doygun renk + hafif glow ile.
   */
  activeBarBg: string;
  activeBarGlow: string;
  /** Hover'da aktif tondan daha soluk ama HÂLÂ modülün kendi renginde — aynı sebeple literal. */
  hoverBg: string;
  hoverBorder: string;
}

/**
 * Sol menü öğeleri — modüller isterler dokümanındaki sırayla listelenir (§5).
 * Yeni bir modül inşa edildiğinde yalnızca ilgili satırın `built` alanı `true` yapılır;
 * menü yapısı/sırası ve rol görünürlüğü baştan doğru kurulmuştur.
 */
export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Panel", href: "/app", module: "dashboard", built: true, icon: Home, accentClass: "text-sky-300", activeBg: "bg-sky-500/15", activeText: "text-sky-100", activeIcon: "text-sky-400", activeIconBg: "bg-sky-400/25", activeBarBg: "bg-sky-400", activeBarGlow: "shadow-[0_0_8px_rgba(56,189,248,0.85)]", hoverBg: "hover:bg-sky-500/10", hoverBorder: "hover:border-sky-500/50" },
  { key: "customers", label: "Müşteriler", href: "/app/musteriler", module: "customer", built: true, icon: Users, accentClass: "text-cyan-300", activeBg: "bg-cyan-500/15", activeText: "text-cyan-100", activeIcon: "text-cyan-400", activeIconBg: "bg-cyan-400/25", activeBarBg: "bg-cyan-400", activeBarGlow: "shadow-[0_0_8px_rgba(34,211,238,0.85)]", hoverBg: "hover:bg-cyan-500/10", hoverBorder: "hover:border-cyan-500/50" },
  { key: "quotes", label: "Teklifler", href: "/app/teklifler", module: "quote", built: true, icon: FileText, accentClass: "text-amber-300", activeBg: "bg-amber-500/15", activeText: "text-amber-100", activeIcon: "text-amber-400", activeIconBg: "bg-amber-400/25", activeBarBg: "bg-amber-400", activeBarGlow: "shadow-[0_0_8px_rgba(251,191,36,0.85)]", hoverBg: "hover:bg-amber-500/10", hoverBorder: "hover:border-amber-500/50" },
  { key: "orders", label: "Siparişler", href: "/app/siparisler", module: "order", built: true, icon: ShoppingBag, accentClass: "text-violet-300", activeBg: "bg-violet-500/15", activeText: "text-violet-100", activeIcon: "text-violet-400", activeIconBg: "bg-violet-400/25", activeBarBg: "bg-violet-400", activeBarGlow: "shadow-[0_0_8px_rgba(167,139,250,0.85)]", hoverBg: "hover:bg-violet-500/10", hoverBorder: "hover:border-violet-500/50" },
  { key: "payments", label: "Tahsilatlar", href: "/app/tahsilatlar", module: "payment", built: true, icon: DollarSign, accentClass: "text-emerald-300", activeBg: "bg-emerald-500/15", activeText: "text-emerald-100", activeIcon: "text-emerald-400", activeIconBg: "bg-emerald-400/25", activeBarBg: "bg-emerald-400", activeBarGlow: "shadow-[0_0_8px_rgba(52,211,153,0.85)]", hoverBg: "hover:bg-emerald-500/10", hoverBorder: "hover:border-emerald-500/50" },
  { key: "expenses", label: "Giderler", href: "/app/giderler", module: "expense", built: true, icon: TrendingDown, accentClass: "text-rose-300", activeBg: "bg-rose-500/15", activeText: "text-rose-100", activeIcon: "text-rose-400", activeIconBg: "bg-rose-400/25", activeBarBg: "bg-rose-400", activeBarGlow: "shadow-[0_0_8px_rgba(251,113,133,0.85)]", hoverBg: "hover:bg-rose-500/10", hoverBorder: "hover:border-rose-500/50" },
  { key: "suppliers", label: "Tedarikçiler", href: "/app/tedarikciler", module: "supplier", built: true, icon: Truck, accentClass: "text-orange-300", activeBg: "bg-orange-500/15", activeText: "text-orange-100", activeIcon: "text-orange-400", activeIconBg: "bg-orange-400/25", activeBarBg: "bg-orange-400", activeBarGlow: "shadow-[0_0_8px_rgba(251,146,60,0.85)]", hoverBg: "hover:bg-orange-500/10", hoverBorder: "hover:border-orange-500/50" },
  { key: "purchaseOrders", label: "Satın Almalar", href: "/app/satin-almalar", module: "supplier", built: true, icon: Package, accentClass: "text-orange-300", activeBg: "bg-orange-500/15", activeText: "text-orange-100", activeIcon: "text-orange-400", activeIconBg: "bg-orange-400/25", activeBarBg: "bg-orange-400", activeBarGlow: "shadow-[0_0_8px_rgba(251,146,60,0.85)]", hoverBg: "hover:bg-orange-500/10", hoverBorder: "hover:border-orange-500/50" },
  { key: "audit", label: "İşlem Geçmişi", href: "/app/islem-gecmisi", module: "auditLog", built: true, icon: Clock, accentClass: "text-slate-300", activeBg: "bg-slate-500/15", activeText: "text-slate-100", activeIcon: "text-slate-400", activeIconBg: "bg-slate-400/25", activeBarBg: "bg-slate-400", activeBarGlow: "shadow-[0_0_8px_rgba(148,163,184,0.85)]", hoverBg: "hover:bg-slate-500/10", hoverBorder: "hover:border-slate-500/50" },
  { key: "users", label: "Kullanıcılar", href: "/app/kullanicilar", module: "userManagement", built: true, icon: UserPlus, accentClass: "text-indigo-300", activeBg: "bg-indigo-500/15", activeText: "text-indigo-100", activeIcon: "text-indigo-400", activeIconBg: "bg-indigo-400/25", activeBarBg: "bg-indigo-400", activeBarGlow: "shadow-[0_0_8px_rgba(129,140,248,0.85)]", hoverBg: "hover:bg-indigo-500/10", hoverBorder: "hover:border-indigo-500/50" },
  { key: "settings", label: "Şirket Ayarları", href: "/app/ayarlar", module: "companySettings", built: true, icon: Settings, accentClass: "text-gray-300", activeBg: "bg-gray-500/15", activeText: "text-gray-100", activeIcon: "text-gray-400", activeIconBg: "bg-gray-400/25", activeBarBg: "bg-gray-300", activeBarGlow: "shadow-[0_0_8px_rgba(209,213,219,0.85)]", hoverBg: "hover:bg-gray-500/10", hoverBorder: "hover:border-gray-500/50" },
];

/** Mobil alt sekme çubuğunda gösterilecek "en önemli" modüller — sırayla ilk N görünür öğe. */
export const MOBILE_PRIMARY_COUNT = 5;

/** Rol bu modülü hiç göremiyorsa (§4'te "—") VEYA modül şirketin lisansında yoksa menüde görünmez. */
export function isNavItemVisible(role: MembershipRole, item: NavItem, enabledModules: readonly string[]): boolean {
  if (!isModuleEnabled(enabledModules, item.module)) return false;
  if (item.module === "dashboard") return true;
  return getRequiredScope(role, item.module, "view") !== null;
}
