"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState, type MouseEvent, type ReactNode } from "react";
import type { MembershipRole } from "@/lib/auth/rbac";
import { NAV_ITEMS, isNavItemVisible } from "@/lib/nav-items";
import { useNavigationPending } from "@/lib/ui/navigation-pending";
import { tr } from "@/lib/i18n/tr";

interface AppShellProps {
  companyName: string;
  role: MembershipRole;
  userName: string;
  userEmail: string;
  hasMultipleCompanies: boolean;
  children: ReactNode;
}

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
 * Logo beyaz (şeffaf kenarlı) olduğu için koyu lacivert (brand-950) zemin üzerine oturur.
 * `next/image` yerine düz `<img>` kullanılır — küçük, sabit bir logo için optimizasyon
 * kazancı önemsizdir ve `next/image` + tam statik sayfa kombinasyonu (bkz. /giris) bilinen
 * bir Next.js 13.5 build hatasına (`Cannot find module for page: /_document`) yol açıyordu.
 */
function LogoMark() {
  return (
    <span className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt={tr.common.appName} className="h-9 w-auto" />
      <span className="text-2xl font-bold tracking-wide text-white/80">CM</span>
    </span>
  );
}

export function AppShell({ companyName, role, userName, userEmail, hasMultipleCompanies, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { navigate } = useNavigationPending();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleItems = NAV_ITEMS.filter((item) => isNavItemVisible(role, item));

  function handleNavClick(e: MouseEvent<HTMLAnchorElement>, href: string) {
    setMobileOpen(false);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (href === pathname) return;
    e.preventDefault();
    // useTransition ile sarılır: isPending, yeni sayfa TAM commit olana kadar true kalır —
    // sidebar tıklamasında loading göstergesi artık varsayıma değil buna dayanıyor.
    navigate(() => router.push(href));
  }

  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      {/* Mobil üst çubuk — yalnızca <lg genişlikte görünür (§9 mobil uyumluluk) */}
      <div className="flex items-center justify-between border-b border-brand-900 bg-brand-950 px-4 py-3 lg:hidden">
        <LogoMark />
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Menüyü kapat" : "Menüyü aç"}
          aria-expanded={mobileOpen}
          className="rounded-md p-2 text-brand-100 hover:bg-brand-900"
        >
          <HamburgerIcon />
        </button>
      </div>

      {/* Sol menü */}
      <aside
        className={`${
          mobileOpen ? "block" : "hidden"
        } bg-brand-950 lg:block lg:min-h-screen lg:w-60 lg:shrink-0`}
      >
        <div className="hidden px-4 py-5 lg:block">
          <LogoMark />
        </div>
        <nav className="space-y-1 px-2 py-3">
          {visibleItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;

            if (!item.built) {
              return (
                <span
                  key={item.key}
                  title="Yakında"
                  className="flex cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-sm text-brand-400"
                >
                  <span className="flex items-center gap-3">
                    <Icon size={16} className="opacity-50" />
                    {item.label}
                  </span>
                  <span className="text-xs">Yakında</span>
                </span>
              );
            }

            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-brand-600 text-white" : "text-brand-100 hover:bg-brand-900"
                }`}
              >
                <Icon size={16} className={active ? "text-white" : item.accentClass} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Ana kolon: header + içerik + footer */}
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 bg-white px-4 py-3 sm:px-6">
          <div>
            <p className="text-sm font-semibold text-brand-900">{companyName}</p>
            <p className="text-xs text-gray-500">{role}</p>
          </div>
          <div className="flex items-center gap-3">
            {hasMultipleCompanies && (
              <Link href="/app/sirket-sec" className="text-xs text-brand-700 hover:text-brand-900 hover:underline">
                Şirket değiştir
              </Link>
            )}
            <div className="text-right">
              <p className="text-sm text-gray-900">{userName}</p>
              <p className="text-xs text-gray-500">{userEmail}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/giris" })}
              className="rounded-md border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
            >
              {tr.auth.logout}
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>

        <footer className="border-t border-gray-200 px-4 py-3 text-center text-xs text-gray-400 sm:px-6">
          {tr.common.appName} · V1
        </footer>
      </div>
    </div>
  );
}
