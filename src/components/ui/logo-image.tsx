"use client";

import { useEffect, useState } from "react";
import { isLightLogo } from "@/lib/ui/logo";

/** Firma logosu — açık renkli (beyaz) logolar beyaz zeminde kaybolmasın diye logo kadar tema renginde koyu bir zemine oturtulur. */
export function LogoImage({ src, className = "", alt = "" }: { src: string; className?: string; alt?: string }) {
  const [light, setLight] = useState(false);
  useEffect(() => {
    let alive = true;
    isLightLogo(src)
      .then((l) => alive && setLight(l))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [src]);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={`object-contain ${light ? "rounded-md bg-brand-800 px-2 py-1" : ""} ${className}`} />
  );
}
