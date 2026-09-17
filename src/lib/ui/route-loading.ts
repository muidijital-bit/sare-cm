"use client";

/**
 * `<Link>` tıklamaları dışındaki programatik yönlendirmeler (filtre çubukları, tarih
 * seçici gibi `router.push()` çağıran yerler) bu event'i tetikleyerek RouteLoadingOverlay'i
 * manuel olarak açar — anchor tıklaması olmadığı için otomatik yakalanamaz.
 * Bkz. src/components/ui/route-loading-overlay.tsx
 */
const EVENT_NAME = "app:route-loading-start";

export function startRouteLoading() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT_NAME));
  }
}

export { EVENT_NAME as ROUTE_LOADING_EVENT };
