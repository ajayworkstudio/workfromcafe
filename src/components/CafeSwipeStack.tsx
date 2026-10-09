"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Icon from "./Icon";

export type StackCafe = {
  id: string;
  slug: string;
  name: string;
  place: string;
  cover: string | null;
  rating: number | null;
  price: string;
  open: boolean | null;
  review: string | null;
  chips: string[];
};

const VISIBLE = 3;          // kartu yang terlihat di tumpukan
const DEPTH_Y = 14;         // jarak turun tiap lapis (px)
const DEPTH_SCALE = 0.05;   // pengecilan tiap lapis

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/*
  Tumpukan kartu gaya Tinder untuk "Baru ditambahkan".
  Seret kartu teratas ke kiri/kanan (jari atau mouse) untuk lanjut ke kafe berikutnya; ketuk untuk
  membuka ulasannya. Tombol dan panah keyboard melakukan hal yang sama, termasuk kembali ke kartu
  sebelumnya. Tidak ada arti suka/tidak suka: geser hanya berarti "lanjut".
*/
export default function CafeSwipeStack({ cafes, title, allHref = "/kafe" }: { cafes: StackCafe[]; title: string; allHref?: string }) {
  const [index, setIndex] = useState(0);
  const cards = useRef(new Map<string, HTMLElement>());
  const stackRef = useRef<HTMLDivElement>(null);
  const enterFrom = useRef<0 | 1 | -1>(0);  // arah datang kartu saat "kembali"
  const busy = useRef(false);
  const dragged = useRef(false);
  const n = cafes.length;
  const done = index >= n;

  // Atur posisi tiap lapis setiap kali kartu teratas berganti
  useLayoutEffect(() => {
    const dur = reduced() ? 0 : 0.35;
    cafes.slice(index, index + VISIBLE).forEach((c, k) => {
      const el = cards.current.get(c.id);
      if (!el) return;
      // Titik tumpu di tepi bawah: kartu belakang mengecil ke atas sehingga tepi bawahnya mengintip
      gsap.set(el, { transformOrigin: "50% 100%" });
      const target = { x: 0, y: k * DEPTH_Y, rotation: 0, scale: 1 - k * DEPTH_SCALE, opacity: 1 };
      if (k === 0 && enterFrom.current) {
        const w = stackRef.current?.offsetWidth ?? 400;
        gsap.fromTo(el, { x: enterFrom.current * w * 1.3, rotation: enterFrom.current * 18, y: 0, scale: 1, opacity: 1 },
          { ...target, duration: reduced() ? 0 : 0.45, ease: "power3.out", onComplete: () => { busy.current = false; } });
        enterFrom.current = 0;
      } else if (!el.dataset.placed) {
        gsap.fromTo(el, { y: (k + 1) * DEPTH_Y, scale: 1 - (k + 1) * DEPTH_SCALE, opacity: 0 }, { ...target, duration: dur, ease: "power2.out" });
      } else {
        gsap.to(el, { ...target, duration: dur, ease: "power2.out" });
      }
      el.dataset.placed = "1";
    });
  }, [index, cafes]);

  const fly = useCallback((dir: 1 | -1) => {
    if (busy.current || index >= n) return;
    const el = cards.current.get(cafes[index].id);
    const w = stackRef.current?.offsetWidth ?? 400;
    if (!el || reduced()) { setIndex((i) => i + 1); return; }
    busy.current = true;
    gsap.to(el, {
      x: dir * w * 1.4, y: "+=40", rotation: dir * 24, duration: 0.42, ease: "power2.in",
      onComplete: () => { busy.current = false; delete el.dataset.placed; setIndex((i) => i + 1); },
    });
  }, [cafes, index, n]);

  const back = useCallback(() => {
    if (busy.current || index === 0) return;
    busy.current = !reduced();
    enterFrom.current = -1;
    setIndex((i) => i - 1);
  }, [index]);

  const restart = () => { setIndex(0); };

  // Seret kartu teratas
  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (busy.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    const el = e.currentTarget;
    const w = stackRef.current?.offsetWidth ?? 400;
    const sx = e.clientX, sy = e.clientY, t0 = performance.now();
    let dx = 0, active = false;
    dragged.current = false;

    const move = (ev: PointerEvent) => {
      dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      if (!active) {
        if (Math.abs(dx) < 8) return;
        if (Math.abs(dy) > Math.abs(dx)) { end(); return; } // gerakan vertikal: biarkan halaman scroll
        active = true; dragged.current = true; el.setPointerCapture(ev.pointerId);
      }
      gsap.set(el, { x: dx, y: dy * 0.15, rotation: dx / 16 });
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (!active) return;
      const speed = Math.abs(dx) / Math.max(1, performance.now() - t0);
      if (Math.abs(dx) > w * 0.28 || (speed > 0.6 && Math.abs(dx) > 40)) fly(dx > 0 ? 1 : -1);
      else gsap.to(el, { x: 0, y: 0, rotation: 0, duration: reduced() ? 0 : 0.5, ease: "elastic.out(1, 0.6)" });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  // Muncul saat pertama terlihat, lalu kartu teratas bergoyang sekali sebagai tanda bisa diseret
  useEffect(() => {
    const stack = stackRef.current;
    if (!stack || reduced()) return;
    gsap.registerPlugin(ScrollTrigger);
    const top = () => cards.current.get(cafes[0]?.id);
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: stack, start: "top 80%", once: true } });
      tl.from(stack, { y: 50, opacity: 0, duration: 0.6, ease: "power3.out" });
      const el = top();
      if (el && n > 1) {
        tl.to(el, { x: -36, rotation: -5, duration: 0.3, ease: "power2.out" }, "+=0.2")
          .to(el, { x: 28, rotation: 4, duration: 0.35, ease: "power2.inOut" })
          .to(el, { x: 0, rotation: 0, duration: 0.4, ease: "elastic.out(1, 0.6)" });
      }
    }, stack);
    return () => ctx.revert();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); fly(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
  };

  const visible = cafes.slice(index, index + VISIBLE);

  return (
    // HP: judul, tumpukan, tombol (urutan DOM). Layar lebar: judul dan tombol di kiri, tumpukan di kanan.
    <div className="grid gap-6 md:grid-cols-[1fr_minmax(0,400px)] md:grid-rows-[1fr_auto_1fr] md:gap-x-16 md:gap-y-0">
      <div className="md:col-start-1 md:row-start-2">
        <h2 className="text-2xl font-bold md:text-5xl md:font-extrabold md:leading-[1.05]">{title}</h2>
        <p className="mt-4 hidden max-w-md text-lg text-ink/75 md:block">
          Seret kartu ke kiri atau kanan untuk lanjut ke kafe berikutnya. Klik kartunya untuk membaca ulasan lengkap.
        </p>
      </div>

      <div className="md:col-start-2 md:row-span-3 md:row-start-1">
        <div ref={stackRef} role="region" aria-roledescription="tumpukan kartu" aria-label="Kafe yang baru ditambahkan"
          tabIndex={0} onKeyDown={onKeyDown}
          className="relative mx-auto aspect-[4/5] w-full max-w-[400px] rounded-[1.75rem] outline-offset-4"
          style={{ marginBottom: (VISIBLE - 1) * DEPTH_Y + 12 }}>
          {done && (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-mist bg-surface p-8 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand"><Icon name="cup" className="h-7 w-7" /></span>
              <p className="mt-4 text-xl font-bold">Itu {n} kafe terbaru.</p>
              <p className="mt-1 text-muted">Masih banyak kafe lain di daftar lengkap.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={restart} className="btn-ghost min-h-11">Ulangi dari awal</button>
                <Link href={allHref} className="btn-primary min-h-11">Lihat semua kafe</Link>
              </div>
            </div>
          )}
          {visible.map((c, k) => (
            <Link key={c.id} href={`/kafe/${c.slug}`}
              ref={(el) => { if (el) cards.current.set(c.id, el); else cards.current.delete(c.id); }}
              onPointerDown={k === 0 ? onPointerDown : undefined}
              onClick={(e) => { if (k !== 0 || dragged.current) { e.preventDefault(); dragged.current = false; } }}
              onDragStart={(e) => e.preventDefault()}
              tabIndex={k === 0 ? 0 : -1} aria-hidden={k !== 0}
              aria-label={k === 0 ? `${c.name}, ${c.place}. Buka ulasan` : undefined}
              style={{ zIndex: VISIBLE - k, touchAction: "pan-y" }}
              className={`absolute inset-0 block select-none overflow-hidden rounded-[1.75rem] bg-tint shadow-[0_18px_40px_-24px_rgba(31,22,18,.55)] ${k === 0 ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"}`}>
              {c.cover ? (
                <Image src={c.cover} alt="" fill draggable={false} sizes="(max-width:768px) 90vw, 400px" className="object-cover" priority={k === 0} />
              ) : (
                <div className="grid h-full place-items-center text-mist"><Icon name="cup" className="h-16 w-16" /></div>
              )}
              <div className="absolute inset-x-0 bottom-0 h-[65%] bg-gradient-to-t from-ink via-ink/80 to-ink/0" />
              {c.open !== null && (
                <span className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-surface/95 px-2.5 py-1 text-xs font-semibold text-ink">
                  <span className={`h-1.5 w-1.5 rounded-full ${c.open ? "bg-ok" : "bg-mist"}`} />{c.open ? "Buka" : "Tutup"}
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 p-5 text-white md:p-6">
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-2xl font-extrabold leading-tight">{c.name}</h3>
                    <p className="mt-0.5 text-sm text-white/85">{c.place}</p>
                  </div>
                  {c.rating != null && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-sm font-bold">
                      <Icon name="star" filled className="h-4 w-4 text-gold" />{c.rating.toFixed(1)}
                    </span>
                  )}
                </div>
                {c.review && <p className="mt-2 line-clamp-2 text-sm text-white/90">{c.review}</p>}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[c.price, ...c.chips].map((t) => (
                    <span key={t} className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">{t}</span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
        <p className="mt-4 text-center text-sm text-muted md:hidden">Geser kartu ke kiri atau kanan. Ketuk untuk buka ulasan.</p>
      </div>

      <div className="md:col-start-1 md:row-start-3 md:self-start">
        <div className="flex items-center justify-center gap-3 md:mt-0 md:justify-start">
          <button type="button" onClick={back} disabled={index === 0} aria-label="Kafe sebelumnya"
            className="grid h-12 w-12 place-items-center rounded-full border border-line bg-surface transition-colors hover:border-brand disabled:opacity-40 disabled:hover:border-line">
            <Icon name="chevron" className="h-5 w-5 rotate-180" />
          </button>
          <p aria-live="polite" className="min-w-16 text-center text-sm font-semibold tabular-nums text-muted">
            {done ? `${n} / ${n}` : `${index + 1} / ${n}`}
          </p>
          <button type="button" onClick={() => fly(1)} disabled={done} aria-label="Kafe berikutnya"
            className="grid h-12 w-12 place-items-center rounded-full bg-brand text-white transition-colors hover:bg-brand-dark disabled:opacity-40">
            <Icon name="chevron" className="h-5 w-5" />
          </button>
        </div>
        <Link href={allHref} className="mt-4 hidden text-sm font-semibold text-brand hover:underline md:inline-block">Lihat semua kafe</Link>
      </div>
    </div>
  );
}
