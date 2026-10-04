"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Icon from "./Icon";

type P = { id: string; url: string };

/**
 * Galeri foto kafe.
 * - HP: geser kiri-kanan (scroll-snap) dengan penanda 1/5.
 * - Layar lebar: 1 foto besar + 2 kecil (atau 1 besar + 1 kecil untuk 2 foto), tombol "Lihat semua foto".
 * - Klik foto mana pun membuka tampilan layar penuh dengan navigasi panah/geser/keyboard.
 */
export default function PhotoGallery({ photos, name }: { photos: P[]; name: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const [slide, setSlide] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(null), []);
  const go = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + photos.length) % photos.length)), [photos.length]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, close, go]);

  if (!photos.length) {
    return (
      <div className="grid aspect-[4/3] place-items-center rounded-[var(--radius-photo)] bg-tint text-mist md:aspect-auto md:h-[420px]">
        <Icon name="cup" className="h-16 w-16" />
      </div>
    );
  }

  const n = photos.length;
  const side = photos.slice(1, 3);

  return (
    <>
      {/* HP: carousel */}
      <div className="relative md:hidden">
        <div ref={track} className="flex snap-x snap-mandatory overflow-x-auto rounded-[var(--radius-photo)] [scrollbar-width:none]"
          onScroll={(e) => { const el = e.currentTarget; setSlide(Math.round(el.scrollLeft / el.clientWidth)); }}>
          {photos.map((p, i) => (
            <button key={p.id} type="button" onClick={() => setOpen(i)} className="relative aspect-[4/3] w-full shrink-0 snap-center bg-tint" aria-label={`Foto ${i + 1} dari ${n}`}>
              <Image src={p.url} alt={i === 0 ? name : ""} fill priority={i === 0} sizes="100vw" className="object-cover" />
            </button>
          ))}
        </div>
        {n > 1 && (
          <>
            <span className="absolute bottom-3 right-3 rounded-full bg-ink/75 px-2.5 py-1 text-xs font-semibold text-white">{slide + 1}/{n}</span>
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5" aria-hidden>
              {photos.slice(0, 8).map((p, i) => <span key={p.id} className={`h-1.5 rounded-full transition-all ${i === slide ? "w-4 bg-white" : "w-1.5 bg-white/60"}`} />)}
            </div>
          </>
        )}
      </div>

      {/* Layar lebar: grid */}
      <div className={`relative hidden gap-2 md:grid ${n >= 2 ? "md:grid-cols-[2fr_1fr]" : ""}`}>
        <button type="button" onClick={() => setOpen(0)} className="group relative h-[420px] overflow-hidden rounded-[var(--radius-photo)] bg-tint">
          <Image src={photos[0].url} alt={name} fill priority sizes="66vw" className="object-cover transition duration-500 group-hover:scale-[1.02]" />
        </button>
        {n >= 2 && (
          <div className={`grid gap-2 ${side.length === 2 ? "grid-rows-2" : ""}`}>
            {side.map((p, i) => (
              <button key={p.id} type="button" onClick={() => setOpen(i + 1)} className="group relative overflow-hidden rounded-[var(--radius-photo)] bg-tint">
                <Image src={p.url} alt="" fill sizes="33vw" className="object-cover transition duration-500 group-hover:scale-[1.03]" />
              </button>
            ))}
          </div>
        )}
        {n > 1 && (
          <button type="button" onClick={() => setOpen(0)} className="btn absolute bottom-4 right-4 bg-surface/95 !py-2 text-sm shadow-md backdrop-blur hover:bg-surface">
            <Icon name="image" className="h-4 w-4" />Lihat semua {n} foto
          </button>
        )}
      </div>

      {/* Tampilan layar penuh */}
      {open !== null && (
        <div role="dialog" aria-modal="true" aria-label={`Foto ${name}`} className="fixed inset-0 z-[60] flex flex-col bg-black/95" onClick={close}>
          <div className="flex items-center justify-between px-4 py-3 text-sm text-white/80">
            <span>{open + 1} / {n}</span>
            <button type="button" onClick={close} className="rounded-full px-3 py-1.5 font-semibold text-white hover:bg-white/10" aria-label="Tutup">Tutup ✕</button>
          </div>
          <div className="relative flex-1" onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => { (e.currentTarget as HTMLDivElement).dataset.x = String(e.touches[0].clientX); }}
            onTouchEnd={(e) => {
              const x0 = Number((e.currentTarget as HTMLDivElement).dataset.x ?? 0);
              const dx = e.changedTouches[0].clientX - x0;
              if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
            }}>
            <Image key={photos[open].id} src={photos[open].url} alt={`${name}, foto ${open + 1}`} fill sizes="100vw" className="object-contain" />
            {n > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label="Foto sebelumnya" className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/25 md:grid">‹</button>
                <button type="button" onClick={() => go(1)} aria-label="Foto berikutnya" className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/25 md:grid">›</button>
              </>
            )}
          </div>
          {n > 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]" onClick={(e) => e.stopPropagation()}>
              {photos.map((p, i) => (
                <button key={p.id} type="button" onClick={() => setOpen(i)} aria-label={`Lihat foto ${i + 1}`}
                  className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg ${i === open ? "ring-2 ring-white" : "opacity-60 hover:opacity-100"}`}>
                  <Image src={p.url} alt="" fill sizes="80px" className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
