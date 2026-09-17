/**
 * Next.js App Router'ın `loading.tsx` Suspense fallback'i — BİLEREK görsel olarak boş
 * bırakıldı. Daha önce burada gri bir "Yükleniyor…" ekranı vardı; Suspense fallback'i eski
 * içeriği DOM'dan söktüğü için sayfa geçişlerinde içerik kaybolup gri ekran görünüyordu.
 * Bunun yerine yükleniyor göstergesi, içeriği yerinde bırakıp üzerini karartan
 * `RouteLoadingOverlay` (src/components/ui/route-loading-overlay.tsx, root layout'ta) ile
 * gösteriliyor. Bu dosya yine de gerekli: yoksa Next.js bu segment için en yakın üst
 * Suspense sınırına düşer.
 */
export default function Loading() {
  return null;
}
