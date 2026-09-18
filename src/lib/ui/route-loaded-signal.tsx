"use client";

/**
 * Yükleniyor katmanını KAPATMANIN tek güvenilir yolu: `template.tsx` Next.js App Router'da
 * her navigasyonda YENİDEN mount edilir (layout.tsx'ten farkı budur) VE bu mount, sunucu
 * verisi/render'ı GERÇEKTEN tamamlanıp React ağaca commit edildiğinde gerçekleşir — yani
 * bu bileşenin `useEffect`'i "yeni sayfa artık ekranda" anını doğru şekilde yakalar.
 *
 * Önceki denemeler (tıklamayı dinleyip pathname değişimini varsaymak, useTransition'ın
 * isPending'i) GÜVENİLİR DEĞİLDİ — kullanıcı raporu: "loading veriler gelmeden kapanıyor,
 * sayfa gri kalıyor". Sebep: Next 13.5'te `router.push()`, React'ın transition/pathname
 * durumuyla RSC veri çekiminin TAM süresini senkron takip etmiyor. `template.tsx`'in mount
 * zamanlaması buna bağlı değil — doğrudan "yeni ağaç commit oldu" anına bağlı.
 */
import { useEffect } from "react";
import { useNavigationPending } from "./navigation-pending";

export function RouteLoadedSignal() {
  const { markLoaded } = useNavigationPending();
  useEffect(() => {
    markLoaded();
    // Yalnızca mount'ta — her template.tsx örneği bir navigasyona karşılık gelir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
