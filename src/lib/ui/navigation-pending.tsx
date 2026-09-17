"use client";

/**
 * Sayfa geçişleri için TEK, paylaşılan yükleniyor sinyali. İki kaynağı birleştirir:
 *
 * 1. `isPending` (React `useTransition`) — sidebar linkleri gibi `navigate()` ile
 *    sarılmış gezinmeler için GÜVENİLİR sinyal: yeni sayfa TAM commit olana kadar `true`
 *    kalır. Önceki yaklaşım (tıklamayı dinleyip pathname değişimini varsaymak) App
 *    Router'da pathname'in tam ne zaman güncellendiğine dair yanlış bir varsayıma
 *    dayanıyordu ve pratikte tetiklenmiyordu (kullanıcı raporu: sidebar'da gezerken gri
 *    ekranda 10sn kalınıyor, hiç loading çıkmıyor).
 * 2. `manualPending` — iki alt kaynağı var: (a) `startRouteLoading()` ile tetiklenen,
 *    `navigate()` kullanmayan yerler (filtre çubukları, tarih seçici gibi düz
 *    `router.push()` çağıran yerler), (b) BU SAĞLAYICININ KENDİSİ dinlediği genel bir
 *    `<a>` tıklama yakalayıcısı — sidebar dışındaki her Link (grid'lerdeki "Düzenle",
 *    sayfalama, "+ Yeni" gibi düzinelerce yer) her birini tek tek `navigate()`'e
 *    sarmaya gerek kalmadan otomatik kapsanır. Bu bayrak, URL (pathname+query) gerçekten
 *    değişip yeni sayfa render olduğunda kapanır.
 */
import { usePathname, useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { ROUTE_LOADING_EVENT } from "./route-loading";

interface NavigationPendingContextValue {
  isPending: boolean;
  navigate: (fn: () => void) => void;
}

const NavigationPendingContext = createContext<NavigationPendingContextValue | null>(null);

export function NavigationPendingProvider({ children }: { children: ReactNode }) {
  const [isPending, startTransition] = useTransition();
  const [manualPending, setManualPending] = useState(false);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentKey = `${pathname}?${searchParams.toString()}`;
  const lastKeyRef = useRef(currentKey);

  useEffect(() => {
    if (lastKeyRef.current !== currentKey) {
      lastKeyRef.current = currentKey;
      setManualPending(false);
    }
  }, [currentKey]);

  useEffect(() => {
    function onStart() {
      setManualPending(true);
    }
    window.addEventListener(ROUTE_LOADING_EVENT, onStart);
    return () => window.removeEventListener(ROUTE_LOADING_EVENT, onStart);
  }, []);

  // Genel yakalayıcı: sidebar dışındaki her <Link> (grid'lerdeki "Düzenle", sayfalama,
  // "+ Yeni", detay sayfası geri bağlantıları vb.) için otomatik kapsama. Sidebar zaten
  // kendi navigate()'ini çağırıyor (daha kesin), bu yalnızca DİĞER her şeyi yakalar.
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
      if (`${url.pathname}?${url.searchParams.toString()}` === currentKey) return;

      setManualPending(true);
    }
    document.addEventListener("click", onAnchorClick);
    return () => document.removeEventListener("click", onAnchorClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey]);

  // Güvenlik ağı: beklenmedik bir durumda katman sonsuza kadar açık kalmasın.
  useEffect(() => {
    if (!manualPending) return;
    const timer = setTimeout(() => setManualPending(false), 15_000);
    return () => clearTimeout(timer);
  }, [manualPending]);

  function navigate(fn: () => void) {
    startTransition(fn);
  }

  return (
    <NavigationPendingContext.Provider value={{ isPending: isPending || manualPending, navigate }}>
      {children}
    </NavigationPendingContext.Provider>
  );
}

export function useNavigationPending(): NavigationPendingContextValue {
  const ctx = useContext(NavigationPendingContext);
  if (!ctx) throw new Error("useNavigationPending, NavigationPendingProvider dışında çağrıldı.");
  return ctx;
}
