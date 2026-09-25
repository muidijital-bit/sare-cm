"use client";

/**
 * Yükleniyor katmanını KAPATAN tek yer. Bu bileşen `template.tsx` içinde render edilir:
 * - mount: yeni bir route segmenti (ör. /app/musteriler → /app/teklifler) commit olduğunda,
 * - pathname/searchParams değişimi: aynı sayfada filtre/sayfalama (?page=2) gibi sorgu
 *   değişimlerinde (template bunlarda yeniden mount olmaz).
 *
 * ÖNEMLİ: Bu sinyallerin "veri geldi" anını doğru yakalaması, route'ta `loading.tsx` OLMAMASINA
 * bağlıdır. `loading.tsx` bir Suspense sınırı yaratır; Next yeni route'u veri gelmeden boş
 * fallback ile commit eder → adres/mount hemen değişir, katman erken kapanır ve sayfa gri
 * kalır (tarayıcıda ölçülerek doğrulandı). `loading.tsx` yokken Next eski sayfayı yerinde tutar
 * ve yeni ağacı veriyle birlikte tek seferde commit eder — o commit'te bu efekt çalışır.
 */
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useNavigationPending } from "./navigation-pending";

export function RouteLoadedSignal() {
  const { markLoaded } = useNavigationPending();
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    markLoaded();
    // markLoaded kararlı bir referans; yalnızca konum değişince çalışması istenir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  return null;
}
