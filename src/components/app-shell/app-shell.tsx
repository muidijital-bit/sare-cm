"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, X, MoreHorizontal, LogOut, Repeat } from "react-feather";
import type { MembershipRole } from "@/lib/auth/rbac";
import { NAV_ITEMS, NAV_GROUPS, MOBILE_PRIMARY_COUNT, isNavItemVisible, type NavItem } from "@/lib/nav-items";
import { tr } from "@/lib/i18n/tr";
import { BRAND } from "@/lib/brand";

interface AppShellProps {
  companyName: string;
  role: MembershipRole;
  userName: string;
  userEmail: string;
  hasMultipleCompanies: boolean;
  enabledModules: string[];
  children: ReactNode;
}

const SIDEBAR_COLLAPSED_KEY = "sare-cm:sidebar-collapsed";

/**
 * Sidebar zemini — mor/indigo gradyan (kullanıcı geri bildirimi: "sol bar lacivert yerine
 * mor gradientli olsun"). Masaüstü kabuk, mobil çekmece VE mobil üst/alt çubuklar aynı
 * sabiti paylaşır, tek yerden değişir.
 */
const SIDEBAR_GRADIENT = "bg-gradient-to-b from-violet-600 via-purple-700 to-indigo-950";

/** Basit hamburger ikonu — küçük bir ikon kütüphanesi eklemeye gerek bırakmaz. */
function HamburgerIcon() {
  return (
    <span className="block" aria-hidden="true">
      <span className="mb-1 block h-0.5 w-5 bg-current" />
      <span className="mb-1 block h-0.5 w-5 bg-current" />
      <span className="block h-0.5 w-5 bg-current" />
    </span>
  );
}

/**
 * Uygulama içinde HERKES muiflow logosunu görür (müşteri firma logosu menüde kullanılmaz).
 * Logo beyaz/şeffaf, koyu zemin üzerine oturur — mor gradyan zeminde de okunur kalır.
 * `next/image` yerine düz `<img>`: küçük sabit logo için optimizasyon kazancı önemsizdir ve
 * `next/image` + tam statik sayfa kombinasyonu bilinen bir Next.js 13.5 build hatasına
 * yol açıyordu.
 */
function LogoMark({ compact = false }: { compact?: boolean }) {
  if (compact) {
    // Daraltılmış menüde tam logoyu sıkıştırmak yerine "mu" amblemi kullanılır.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={BRAND.mark} alt={BRAND.name} className="h-5 w-auto shrink-0" />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={BRAND.logoWhite} alt={BRAND.name} className="h-7 w-auto shrink-0" />;
}

export function AppShell({ companyName, role, userName, userEmail, hasMultipleCompanies, enabledModules, children }: AppShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Masaüstü daraltma tercihi yalnızca bu tarayıcıya özgü bir konfor ayarı — sunucudan
  // farklı bir ilk render'a (hydration mismatch) yol açmaması için mount SONRASI okunur.
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      // localStorage kapalı/erişilemez olabilir (gizli sekme vb.) — varsayılan (açık) kalır.
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // yoksay — sadece bu oturumda hatırlanamaz.
      }
      return next;
    });
  }

  const visibleItems = NAV_ITEMS.filter((item) => isNavItemVisible(role, item, enabledModules));
  const primaryItems = visibleItems.slice(0, MOBILE_PRIMARY_COUNT);

  function renderNavLink(item: NavItem, opts: { compact?: boolean; onClick?: () => void }) {
    const active = pathname === item.href;
    const Icon = item.icon;
    const compact = opts.compact ?? false;

    if (!item.built) {
      return (
        <span
          key={item.key}
          title="Yakında"
          className={`flex cursor-not-allowed items-center rounded-lg px-3 py-2.5 text-sm text-white/40 ${
            compact ? "justify-center" : "justify-between gap-3"
          }`}
        >
          <span className={`flex items-center ${compact ? "" : "gap-3"}`}>
            <Icon size={17} className="opacity-50" />
            {!compact && item.label}
          </span>
          {!compact && <span className="text-xs">Yakında</span>}
        </span>
      );
    }

    return (
      <Link
        key={item.key}
        href={item.href}
        onClick={opts.onClick}
        title={compact ? item.label : undefined}
        className={`flex items-center rounded-lg px-3 py-2.5 text-theme-sm font-medium transition-all ${
          compact ? "justify-center" : "gap-3"
        } ${active ? "bg-white/15 text-white shadow-theme-xs" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
      >
        <Icon size={17} className="shrink-0" />
        {!compact && <span className="truncate">{item.label}</span>}
      </Link>
    );
  }

  /** Grup başlığı + o gruptaki görünür öğeler — boş gruplar (lisans/rol nedeniyle) atlanır. */
  function renderNavGroups(opts: { compact?: boolean; onClick?: () => void }) {
    return NAV_GROUPS.map((group) => {
      const items = visibleItems.filter((item) => item.group === group.key);
      if (items.length === 0) return null;
      return (
        <div key={group.key} className="mt-5 first:mt-0">
          {!opts.compact && (
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-white/45">{group.label}</p>
          )}
          <div className="space-y-0.5">{items.map((item) => renderNavLink(item, opts))}</div>
        </div>
      );
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      {/* Mobil üst çubuk — yalnızca <lg genişlikte görünür */}
      <div className={`flex items-center justify-between px-4 py-3 lg:hidden ${SIDEBAR_GRADIENT}`}>
        <LogoMark />
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Menüyü aç"
          aria-expanded={drawerOpen}
          className="rounded-md p-2 text-white/90 hover:bg-white/10"
        >
          <HamburgerIcon />
        </button>
      </div>

      {/* Mobil tam menü — kaydırmalı çekmece (drawer) + arka plan karartması */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden ${
          drawerOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden={!drawerOpen}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col shadow-2xl transition-transform duration-200 ease-out lg:hidden ${SIDEBAR_GRADIENT} ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
          <LogoMark />
          <button onClick={() => setDrawerOpen(false)} aria-label="Menüyü kapat" className="rounded-md p-2 text-white/80 hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3">{renderNavGroups({ onClick: () => setDrawerOpen(false) })}</nav>
        <div className="space-y-2 border-t border-white/10 px-4 py-4">
          <p className="truncate text-sm text-white">{userName}</p>
          <p className="truncate text-xs text-white/60">{userEmail}</p>
          {hasMultipleCompanies && (
            <Link href="/app/sirket-sec" onClick={() => setDrawerOpen(false)} className="flex items-center gap-2 text-xs text-white/60 hover:text-white">
              <Repeat size={13} /> Şirket değiştir
            </Link>
          )}
          <button onClick={() => signOut({ callbackUrl: "/giris" })} className="flex items-center gap-2 pt-1 text-xs font-medium text-white/60 hover:text-white">
            <LogOut size={13} /> {tr.auth.logout}
          </button>
        </div>
      </aside>

      {/* Masaüstü sol menü — daraltılabilir */}
      <aside
        className={`relative hidden shrink-0 transition-[width] duration-200 ease-out lg:flex lg:min-h-screen lg:flex-col ${SIDEBAR_GRADIENT} ${
          collapsed ? "lg:w-[72px]" : "lg:w-64"
        }`}
      >
        <div className={`flex items-center border-b border-white/10 px-4 py-5 ${collapsed ? "justify-center px-2" : "justify-between"}`}>
          <LogoMark compact={collapsed} />
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3">{renderNavGroups({ compact: collapsed })}</nav>
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
          className="flex items-center justify-center gap-2 border-t border-white/10 py-3 text-xs font-medium text-white/60 hover:bg-white/5 hover:text-white"
        >
          {collapsed ? (
            <ChevronRight size={15} />
          ) : (
            <>
              <ChevronLeft size={15} /> Daralt
            </>
          )}
        </button>
      </aside>

      {/* Ana kolon: header + içerik + footer */}
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="hidden flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 shadow-theme-xs sm:px-6 lg:flex">
          <div>
            <p className="text-theme-sm font-semibold text-gray-800">{companyName}</p>
            <p className="text-theme-xs text-gray-500">{role}</p>
          </div>
          <div className="flex items-center gap-4">
            {hasMultipleCompanies && (
              <Link href="/app/sirket-sec" className="text-theme-xs text-brand-600 hover:text-brand-800 hover:underline">
                Şirket değiştir
              </Link>
            )}
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-700 text-sm font-semibold text-white">
                {userName.trim().charAt(0).toUpperCase() || "?"}
              </span>
              <div className="text-right">
                <p className="text-theme-sm text-gray-800">{userName}</p>
                <p className="text-theme-xs text-gray-500">{userEmail}</p>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/giris" })}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-theme-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {tr.auth.logout}
            </button>
          </div>
        </header>

        {/* Mobilde şirket adı — üst çubuğun kalabalıklaşmaması için ince bir şerit */}
        <div className="border-b border-gray-200 bg-white px-4 py-2 sm:px-6 lg:hidden">
          <p className="truncate text-sm font-semibold text-gray-800">{companyName}</p>
        </div>

        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:pb-6">{children}</main>

        <footer className="hidden border-t border-gray-200 px-4 py-3 text-center text-xs text-gray-400 sm:px-6 lg:block">
          {BRAND.name} · V1
        </footer>
      </div>

      {/* Mobil alt sekme çubuğu — en önemli modüllere tek dokunuşla erişim */}
      <nav className={`fixed inset-x-0 bottom-0 z-30 flex pb-[env(safe-area-inset-bottom)] lg:hidden ${SIDEBAR_GRADIENT}`} aria-label="Ana menü">
        {primaryItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          if (!item.built) return null;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${active ? "text-white" : "text-white/60"}`}
            >
              <span className={`flex h-7 w-11 items-center justify-center rounded-full transition-colors ${active ? "bg-white/20" : ""}`}>
                <Icon size={18} />
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
        <button onClick={() => setDrawerOpen(true)} className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-white/60">
          <span className="flex h-7 w-11 items-center justify-center">
            <MoreHorizontal size={18} />
          </span>
          Diğer
        </button>
      </nav>
    </div>
  );
}
