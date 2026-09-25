/**
 * `template.tsx` her segment değişiminde yeniden mount edilir; içindeki RouteLoadedSignal
 * yükleniyor katmanını kapatır (segment mount'u + aynı sayfada pathname/searchParams değişimi).
 *
 * KURAL: bu segmentlere `loading.tsx` EKLEMEYİN. loading.tsx bir Suspense sınırı yaratır; Next
 * yeni sayfayı veri gelmeden boş fallback'le commit eder → katman erken kapanır, ekran gri kalır
 * (tarayıcıda ölçülerek doğrulandı). Yükleniyor göstergesi src/lib/ui/navigation-pending.tsx +
 * src/components/ui/route-loading-overlay.tsx ile yapılır.
 */
import { RouteLoadedSignal } from "@/lib/ui/route-loaded-signal";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RouteLoadedSignal />
      {children}
    </>
  );
}
