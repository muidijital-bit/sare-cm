/**
 * `template.tsx` — `layout.tsx`'in aksine HER navigasyonda yeniden mount edilir, ve bu
 * mount ancak yeni sayfanın sunucu verisi/render'ı TAMAMLANIP React ağaca commit
 * olduğunda gerçekleşir. Bu yüzden yükleniyor katmanını KAPATMAK için buradaki mount
 * effect'i (bkz. RouteLoadedSignal) kullanılıyor — bkz. src/lib/ui/navigation-pending.tsx.
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
