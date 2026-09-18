"use client";

/**
 * Sayfa geçişleri için TEK, paylaşılan yükleniyor sinyali.
 *
 * AÇMA (pending=true): iki kaynak —
 * 1. Genel `<a>` tıklama yakalayıcısı (sidebar, grid "Düzenle", sayfalama, "+ Yeni" —
 *    HER Link, tek tek sarmaya gerek kalmadan).
 * 2. `startRouteLoading()` — Link olmayan, düz `router.push()` çağıran yerler (filtre
 *    çubukları, tarih seçici).
 *
 * KAPATMA (pending=false): SADECE `markLoaded()` — bkz. src/lib/ui/route-loaded-signal.tsx.
 * Bu, `template.tsx` içinde render edilen bir bileşenin mount effect'inden gelir; Next.js
 * App Router'da `template.tsx` her navigasyonda YENİDEN mount edilir ve bu mount ancak
 * yeni sayfanın verisi/render'ı TAMAMLANIP React ağaca commit olduğunda gerçekleşir.
 *
 * ÖNCEKİ YAKLAŞIM (pathname/searchParams değişimini izleyip kapatmak, ya da React
 * useTransition'ın isPending'i) GÜVENİLİR DEĞİLDİ — kullanıcı raporu: "loading veriler
 * gelmeden kapanıyor, sayfa gri kalıyor". Next 13.5'te `router.push()` bu durumları RSC veri
 * çekiminin TAM süresiyle senkron tutmuyor. `markLoaded()` buna bağlı değil.
 */
import { useCallback, useEffect, useRef, useState, createContext, useContext, type ReactNode } from "react";
import { ROUTE_LOADING_EVENT } from "./route-loading";

interface NavigationPendingContextValue {
  isPending: boolean;
  /** Yeni sayfa gerçekten render olup commit olduğunda RouteLoadedSignal tarafından çağrılır. */
  markLoaded: () => void;
}

const NavigationPendingContext = createContext<NavigationPendingContextValue | null>(null);

/** Sonsuza kadar açık kalmasın diye güvenlik ağı — gerçek kapatma her zaman markLoaded(). */
const SAFETY_TIMEOUT_MS = 20_000;

export function NavigationPendingProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState(false);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSafetyTimer = useCallback(() => {
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  const startPending = useCallback(() => {
    setPending(true);
    clearSafetyTimer();
    safetyTimerRef.current = setTimeout(() => setPending(false), SAFETY_TIMEOUT_MS);
  }, [clearSafetyTimer]);

  const markLoaded = useCallback(() => {
    clearSafetyTimer();
    setPending(false);
  }, [clearSafetyTimer]);

  // Kaynak 2: startRouteLoading() ile tetiklenen manuel sinyal.
  useEffect(() => {
    function onStart() {
      startPending();
    }
    window.addEventListener(ROUTE_LOADING_EVENT, onStart);
    return () => window.removeEventListener(ROUTE_LOADING_EVENT, onStart);
  }, [startPending]);

  // Kaynak 1: genel <a> tıklama yakalayıcısı — sidebar, grid "Düzenle", sayfalama, "+ Yeni".
  useEffect(() => {
    function onAnchorClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (`${url.pathname}${url.search}` === `${window.location.pathname}${window.location.search}`) return;

      startPending();
    }
    document.addEventListener("click", onAnchorClick);
    return () => document.removeEventListener("click", onAnchorClick);
  }, [startPending]);

  return <NavigationPendingContext.Provider value={{ isPending: pending, markLoaded }}>{children}</NavigationPendingContext.Provider>;
}

export function useNavigationPending(): NavigationPendingContextValue {
  const ctx = useContext(NavigationPendingContext);
  if (!ctx) throw new Error("useNavigationPending, NavigationPendingProvider dışında çağrıldı.");
  return ctx;
}
