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
 * 2. `manualPending` — `startRouteLoading()` ile tetiklenen, `navigate()` kullanmayan
 *    yerler için (filtre çubukları, tarih seçici gibi düz `router.push()` çağıran yerler).
 *    Bu bayrak, URL (pathname+query) gerçekten değişip yeni sayfa render olduğunda kapanır.
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
