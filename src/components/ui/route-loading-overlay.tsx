"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ROUTE_LOADING_EVENT } from "@/lib/ui/route-loading";

/**
 * Sayfa geçişlerinde İÇERİĞİ KALDIRMADAN üstüne yarı saydam siyah bir katman + beyaz
 * spinner koyar. Next.js'in `loading.tsx` mekanizması Suspense fallback'i olduğu için
 * eski içeriği DOM'dan söküp gri bir ekran gösteriyordu; kullanıcı deneyimi olarak
 * istenen "sayfa kalsın, üzeri kararsın" davranışı ancak bunun gibi kendi pending
 * göstergemizle mümkün (bkz. app/loading.tsx artık görsel olarak boş).
 *
 * Nasıl çalışır:
 * - `<Link>` tıklamaları anchor yakalayıcısıyla (olay delegasyonu) anında algılanır.
 * - Programatik `router.push()` çağrıları `startRouteLoading()` ile aynı katmanı açar.
 * - URL (pathname + query) değiştiğinde yeni sayfa render edilmiş sayılır ve katman kapanır.
 */
export function RouteLoadingOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);

  const currentKey = `${pathname}?${searchParams.toString()}`;
  const lastKeyRef = useRef(currentKey);

  // Yeni rota geldiğinde katmanı kapat.
  useEffect(() => {
    if (lastKeyRef.current !== currentKey) {
      lastKeyRef.current = currentKey;
      setPending(false);
    }
  }, [currentKey]);

  useEffect(() => {
    function onAnchorClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Aynı sayfaya tıklandıysa gösterme.
      if (`${url.pathname}?${url.searchParams.toString()}` === currentKey) return;

      setPending(true);
    }

    function onManualStart() {
      setPending(true);
    }

    document.addEventListener("click", onAnchorClick);
    window.addEventListener(ROUTE_LOADING_EVENT, onManualStart);
    return () => {
      document.removeEventListener("click", onAnchorClick);
      window.removeEventListener(ROUTE_LOADING_EVENT, onManualStart);
    };
  }, [currentKey]);

  // Güvenlik ağı: beklenmeyen bir durumda katman sonsuza kadar açık kalmasın.
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setPending(false), 15_000);
    return () => clearTimeout(timer);
  }, [pending]);

  if (!pending) return null;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/45 backdrop-blur-[1px]"
      role="status"
      aria-live="polite"
      aria-label="Yükleniyor"
    >
      <div className="flex flex-col items-center gap-4">
        <span className="relative flex h-14 w-14 items-center justify-center">
          <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-white/25 border-t-white" />
          <span className="absolute inset-[6px] animate-ping rounded-full bg-white/20" />
        </span>
        <p className="text-sm font-medium tracking-wide text-white">Yükleniyor…</p>
      </div>
    </div>
  );
}
