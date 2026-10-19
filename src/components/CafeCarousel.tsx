"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Cafe } from "@/lib/types";
import { coverUrl, isOpenNow, priceLabel } from "@/lib/utils";
import { averageScore } from "@/lib/review";
import { CROWD, reportAgo, type LiveSummary } from "@/lib/reports";
import Icon from "./Icon";

type Item = { c: Cafe; d: number | null };

const CROWD_CHIP = { 1: "bg-[#6fd09a]/25 text-[#c8f3da]", 2: "bg-gold/30 text-[#ffe2b0]", 3: "bg-[#e07a5f]/30 text-[#ffd2c4]" } as const;
const fmt = (d: number) => (d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(d < 10 ? 1 : 0)} km`);

/**
 * Daftar kafe sebagai carousel kartu (HP): geser ke samping, kartu di tengah membesar,
 * kartu di kiri-kanan mengecil dan meredup. Berbeda dari tumpukan kartu di beranda:
 * semua kafe tetap terlihat berurutan dan bisa digeser bolak-balik.
 */
export default function CafeCarousel({ items, live }: { items: Item[]; live: Record<string, LiveSummary> }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const mid = el.scrollLeft + el.clientWidth / 2;
        let best = 0, bestDist = Infinity;
        Array.from(el.children).forEach((ch, i) => {
          const c = ch as HTMLElement;
          const dist = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
          if (dist < bestDist) { bestDist = dist; best = i; }
        });
        setActive(best);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  // Urutan berubah (mis. diurutkan dari yang terdekat): kembali ke kartu pertama
  const key = items.map((i) => i.c.id).join(",");
  useEffect(() => { track.current?.scrollTo({ left: 0 }); setActive(0); }, [key]);

  const go = (i: number) => {
    const el = track.current;
    const ch = el?.children[i] as HTMLElement | undefined;
    if (el && ch) el.scrollTo({ left: ch.offsetLeft - (el.clientWidth - ch.offsetWidth) / 2, behavior: "smooth" });
  };

  if (!items.length) return null;
  return (
    <div className="mt-5" aria-roledescription="carousel" aria-label="Daftar kafe">
      <div ref={track} className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-[9%] pb-2 [scrollbar-width:none]">
        {items.map(({ c, d }, i) => {
          const cover = coverUrl(c);
          const rating = c.my_rating != null ? Number(c.my_rating) : averageScore(c.scores);
          const open = isOpenNow(c.opening_hours);
          const l = live[c.id];
          const names = (c.tags ?? []).map((t) => t.tag?.name);
          const wifi = names.includes("Wifi") || c.amenities?.wifi === true;
          const plug = names.includes("Colokan") || c.amenities?.colokan === true;
          const on = i === active;
          return (
            <Link key={c.id} href={`/kafe/${c.slug}`} aria-label={`${c.name}, ${i + 1} dari ${items.length}`}
              className={`relative block aspect-[3/4.1] w-[82%] shrink-0 snap-center overflow-hidden rounded-[2rem] bg-ink text-foam transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none ${on ? "scale-100 opacity-100" : "scale-[.92] opacity-60"}`}>
              {cover
                ? <Image src={cover} alt="" fill sizes="82vw" priority={i === 0} className="object-cover" />
                : <div className="grid h-full place-items-center text-foam/30"><Icon name="cup" className="h-14 w-14" /></div>}
              <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-ink/45 to-ink/0" aria-hidden />

              <div className="absolute inset-x-3 top-3 flex flex-wrap gap-1.5 text-xs font-bold">
                {open !== null && (
                  <span className="glass-dark flex items-center gap-1.5 rounded-full px-2.5 py-1">
                    <span className={`h-1.5 w-1.5 rounded-full ${open ? "bg-[#6fd09a]" : "bg-mist"}`} />{open ? "Buka" : "Tutup"}
                  </span>
                )}
                {d != null && <span className="glass-dark rounded-full px-2.5 py-1">{fmt(d)}</span>}
              </div>

              <div className="glass-dark absolute inset-x-2.5 bottom-2.5 space-y-2 rounded-[1.5rem] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-xl font-extrabold leading-tight">{c.name}</p>
                    <p className="mt-0.5 truncate text-sm text-foam/80">{[c.area, c.city?.name].filter(Boolean).join(", ")}</p>
                  </div>
                  {rating != null && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-sm font-extrabold">
                      <Icon name="star" filled className="h-3.5 w-3.5 text-gold" />{rating.toFixed(1)}
                    </span>
                  )}
                </div>
                <p className="flex flex-wrap gap-1.5 text-xs font-bold">
                  {l && <span className={`rounded-full px-2 py-1 ${CROWD_CHIP[l.crowd]}`}>{CROWD[l.crowd].label} · {reportAgo(l.last_at)}</span>}
                  {l?.download_mbps != null && <span className="rounded-full bg-white/15 px-2 py-1">{Math.round(Number(l.download_mbps))} Mbps</span>}
                  <span className="rounded-full bg-white/15 px-2 py-1">{priceLabel(c.price_range)}</span>
                  {wifi && <span className="rounded-full bg-white/15 px-2 py-1">Wifi</span>}
                  {plug && <span className="rounded-full bg-white/15 px-2 py-1">Colokan</span>}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Penanda posisi + tombol geser (juga untuk pengguna keyboard / pembaca layar) */}
      <div className="mt-3 flex items-center justify-between gap-3 px-1">
        <button type="button" onClick={() => go(Math.max(0, active - 1))} disabled={active === 0} aria-label="Kafe sebelumnya"
          className="grid h-11 w-11 place-items-center rounded-full border border-line bg-surface disabled:opacity-40">
          <Icon name="back" className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5" aria-hidden>
          {items.length <= 12
            ? items.map((it, i) => <span key={it.c.id} className={`h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-ink" : "w-1.5 bg-mist"}`} />)
            : null}
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-muted" aria-live="polite">{active + 1}/{items.length}</span>
        <button type="button" onClick={() => go(Math.min(items.length - 1, active + 1))} disabled={active === items.length - 1} aria-label="Kafe berikutnya"
          className="grid h-11 w-11 place-items-center rounded-full bg-ink text-white disabled:opacity-40">
          <Icon name="chevron" className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
