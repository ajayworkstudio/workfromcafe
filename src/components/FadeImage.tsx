"use client";
import Image, { type ImageProps } from "next/image";
import { useState } from "react";

/**
 * Foto yang muncul halus: selama dimuat tampil kerangka berkilau, lalu foto memudar masuk dari buram ke tajam.
 * Dipakai untuk foto kafe dengan `fill`; induknya harus `relative`. `lowSrc` (thumbnail) menggantikan kerangka bila ada.
 */
export default function FadeImage({ className = "", onLoad, lowSrc, ...props }: ImageProps & { lowSrc?: string | null }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {/* lowSrc: versi kecil yang biasanya sudah ada di cache (dari kartu), tampil dulu sampai foto besar siap */}
      {!loaded && (lowSrc
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={lowSrc} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
        : <span aria-hidden className="img-shimmer absolute inset-0" />)}
      <Image {...props} alt={props.alt ?? ""} data-fade={loaded ? "done" : "pending"} className={`fade-img ${className}`}
        onLoad={(e) => { setLoaded(true); onLoad?.(e); }} />
    </>
  );
}
