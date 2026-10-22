"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import FadeImage from "./FadeImage";
import Icon from "./Icon";
import type { StackCafe } from "./CafeSwipeStack";

const AUTO_MS = 5000;

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/*
  Panel melebar untuk "Baru ditambahkan". Semua kafe tampil sebagai irisan foto; satu panel terbuka lebar
  dengan info lengkap. Panel berganti sendiri tiap 5 detik (garis tipis di bawah panel menunjukkan waktunya).
  Ketuk irisan lain untuk membukanya, ketuk panel yang terbuka untuk membaca ulasan.
  HP: irisan bertumpuk ke bawah (nama tetap terbaca mendatar). Layar lebar: irisan berjajar ke samping.
  Tinggi total selalu sama, jadi halaman tidak bergeser saat panel berganti.
*/
export default function CafeShowcase({ cafes, title, allHref = "/kafe" }: { cafes: StackCafe[]; title: string; allHref?: string }) {
  const [active, setActive] = useState(0);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [holding, setHolding] = useState(false);
  const [motionOk, setMotionOk] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const root = useRef<HTMLDivElement>(null);
  const n = cafes.length;
  const running = motionOk && inView && pageVisible && !holding && n > 1;

  useEffect(() => {
    setMotionOk(!reduced());
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    const onVis = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", onVis); clearTimeout(holdTimer.current); };
  }, []);

  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setActive((i) => (i + 1) % n), AUTO_MS);
    return () => clearTimeout(t);
  }, [running, active, n]);

  // Disentuh / diarahkan / difokus: berhenti sebentar, lanjut setelah dilepas
  const hold = () => { clearTimeout(holdTimer.current); setHolding(true); };
  const release = (ms: number) => { clearTimeout(holdTimer.current); holdTimer.current = setTimeout(() => setHolding(false), ms); };

  if (!n) return null;

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-2xl font-bold md:text-4xl md:font-extrabold">{title}</h2>
        <Link href={allHref} className="shrink-0 py-2 text-sm font-semibold text-brand hover:underline">Lihat semua kafe</Link>
      </div>

      <div ref={root} role="region" aria-roledescription="galeri kafe" aria-label={title}
        onMouseEnter={hold} onMouseLeave={() => release(600)}
        onPointerDown={(e) => { if (e.pointerType !== "mouse") { hold(); release(6000); } }}
        onFocus={hold} onBlur={() => release(2000)}
        className="mt-5 flex h-[calc(23rem+var(--n)*4.75rem)] flex-col gap-2 md:h-[30rem] md:flex-row"
        style={{ ["--n" as string]: n - 1 }}>
        {cafes.map((c, i) => {
          const on = i === active;
          return (
            <div key={c.id}
              className={`group relative min-h-[4.25rem] min-w-0 overflow-hidden rounded-[1.5rem] bg-espresso text-foam transition-[flex-grow] duration-700 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none md:min-w-[4.5rem] ${on ? "grow-[12] md:grow-[8]" : "grow-0 md:grow"}`}>
              {c.cover && (
                <FadeImage src={c.cover} alt="" fill sizes="(max-width:768px) 100vw, 60vw"
                  className={`object-cover transition-[opacity,filter] duration-700 ${on ? "showcase-zoom" : "opacity-60 brightness-75"}`} />
              )}
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-t from-espresso via-espresso/55 to-espresso/0 transition-opacity duration-500 ${on ? "opacity-100" : "opacity-70"}`} />

              {on ? (
                <Link href={`/kafe/${c.slug}`} aria-label={`${c.name}, ${c.place}. Buka ulasan`}
                  className="absolute inset-0 flex flex-col justify-end p-5 md:p-7">
                  {c.open !== null && (
                    <span className="glass absolute left-4 top-4 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold">
                      <span className={`h-1.5 w-1.5 rounded-full ${c.open ? "bg-[#6fd09a]" : "bg-mist"}`} />{c.open ? "Buka" : "Tutup"}
                    </span>
                  )}
                  <div key={active} className="showcase-in">
                    <div className="flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-2xl font-extrabold leading-tight md:text-4xl">{c.name}</h3>
                        <p className="mt-1 text-sm text-foam/85">{c.place}</p>
                      </div>
                      {c.rating != null && (
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-sm font-bold">
                          <Icon name="star" filled className="h-4 w-4 text-gold" />{c.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    {c.review && <p className="mt-2 line-clamp-2 max-w-xl text-sm text-foam/90 md:text-base">{c.review}</p>}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {[c.price, ...c.chips].map((t) => <span key={t} className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">{t}</span>)}
                    </div>
                  </div>
                  {/* Waktu menuju kafe berikutnya */}
                  {n > 1 && (
                    <span aria-hidden className="absolute inset-x-5 bottom-2.5 h-[3px] overflow-hidden rounded-full bg-white/20 md:inset-x-7">
                      {running && <span key={active} className="block h-full origin-left rounded-full bg-gold animate-[stack-progress_5s_linear_forwards]" />}
                    </span>
                  )}
                </Link>
              ) : (
                <button type="button" onClick={() => setActive(i)} aria-label={`Tampilkan ${c.name}`}
                  className="absolute inset-0 flex items-center gap-3 px-5 text-left md:flex-col md:items-center md:justify-end md:px-0 md:pb-6">
                  <span className="min-w-0 truncate text-base font-bold md:max-h-[22rem] md:truncate md:[writing-mode:vertical-rl] md:rotate-180">{c.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-foam/75 md:hidden">{c.place.split(",").pop()?.trim()}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
