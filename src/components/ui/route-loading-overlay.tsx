"use client";

import { useNavigationPending } from "@/lib/ui/navigation-pending";

/**
 * Sayfa geçişlerinde İÇERİĞİ KALDIRMADAN üstüne yarı saydam siyah bir katman + beyaz
 * spinner koyar. `isPending`, NavigationPendingProvider'dan (bkz. src/lib/ui/navigation-pending.tsx)
 * gelir — React'ın kendi `useTransition()` durumuna dayanır, tıklama tahminine değil.
 */
export function RouteLoadingOverlay() {
  const { isPending } = useNavigationPending();

  if (!isPending) return null;

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
