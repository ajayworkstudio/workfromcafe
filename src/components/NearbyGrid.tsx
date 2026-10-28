"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import CafeCard from "./CafeCard";
import CafeCarousel from "./CafeCarousel";
import Icon from "./Icon";
import type { Cafe } from "@/lib/types";
import type { LiveSummary } from "@/lib/reports";

function km(a: [number, number], b: [number, number]) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const fmt = (d: number) => (d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(d < 10 ? 1 : 0)} km`);

/** Daftar kafe dengan tombol "Urutkan dari yang terdekat" (lokasi hanya dipakai di HP/browser, tidak dikirim ke server). */
const PER_PAGE = 5;

/** Nomor halaman yang ditampilkan: 1 … 4 5 6 … 12 (selalu halaman pertama, terakhir, dan tetangga halaman aktif). */
function pageList(cur: number, total: number): (number | "…")[] {
  const keep = new Set([1, total, cur - 1, cur, cur + 1].filter((n) => n >= 1 && n <= total));
  const out: (number | "…")[] = [];
  [...keep].sort((a, b) => a - b).forEach((n, i, arr) => { if (i && n - arr[i - 1] > 1) out.push("…"); out.push(n); });
  return out;
}

export default function NearbyGrid({ cafes, live = {}, initialPage = 1 }: { cafes: Cafe[]; live?: Record<string, LiveSummary>; initialPage?: number }) {
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "denied" | "unsupported">("idle");
  // HP: kartu yang digeser (bawaan) atau daftar biasa
  const [view, setView] = useState<"kartu" | "daftar">("kartu");

  function locate() {
    if (!("geolocation" in navigator)) return setState("unsupported");
    setState("loading");
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos([p.coords.latitude, p.coords.longitude]); setState("idle"); },
      () => setState("denied"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }

  const list = useMemo(() => {
    if (!pos) return cafes.map((c) => ({ c, d: null as number | null }));
    return cafes
      .map((c) => ({ c, d: c.lat != null && c.lng != null ? km(pos, [c.lat, c.lng]) : null }))
      .sort((x, y) => (x.d ?? Infinity) - (y.d ?? Infinity));
  }, [cafes, pos]);

  // Halaman: 5 kafe per halaman. Nomor halaman disimpan di alamat (?hal=2) supaya bisa dibagikan & tetap saat dimuat ulang.
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const [page, setPage] = useState(Math.min(Math.max(1, initialPage), pages));
  const top = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  // Filter atau urutan berubah: kembali ke halaman 1
  useEffect(() => { if (first.current) { first.current = false; return; } setPage(1); }, [cafes, pos]);
  useEffect(() => {
    const url = new URL(location.href);
    if (page > 1) url.searchParams.set("hal", String(page)); else url.searchParams.delete("hal");
    if (url.href !== location.href) history.replaceState(history.state, "", url);
  }, [page]);
  const go = (n: number) => {
    setPage(Math.min(Math.max(1, n), pages));
    top.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };
  const shown = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <>
      <div ref={top} className="mt-4 flex scroll-mt-24 flex-wrap items-center gap-3">
        <div role="group" aria-label="Tampilan" className="flex rounded-full border border-line bg-surface p-1 md:hidden">
          {(["kartu", "daftar"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}
              className={`min-h-9 rounded-full px-3.5 text-sm font-semibold capitalize ${view === v ? "bg-ink text-white" : "text-muted"}`}>
              {v}
            </button>
          ))}
        </div>
        {pos ? (
          <button onClick={() => setPos(null)} className="btn min-h-11 border border-brand bg-brand-soft text-brand !py-2"><Icon name="locate" className="h-4 w-4" />Terdekat dulu<span className="hidden md:inline"> (diurutkan)</span></button>
        ) : (
          <button onClick={locate} disabled={state === "loading"} className="btn-ghost min-h-11 !py-2"><Icon name="locate" className="h-4 w-4" />{state === "loading" ? "Mencari lokasimu…" : <><span className="md:hidden">Terdekat</span><span className="hidden md:inline">Urutkan dari yang terdekat</span></>}</button>
        )}
        {state === "denied" && <span className="text-sm text-muted">Izin lokasi ditolak. Aktifkan izin lokasi di browser, lalu coba lagi.</span>}
        {state === "unsupported" && <span className="text-sm text-muted">Browser ini tidak mendukung lokasi.</span>}
      </div>
      {view === "kartu" && <div className="md:hidden"><CafeCarousel items={shown} live={live} /></div>}
      <div className={`mt-6 gap-x-5 gap-y-9 sm:grid-cols-2 md:grid lg:grid-cols-3 ${view === "daftar" ? "grid" : "hidden"}`}>
        {shown.map(({ c, d }) => (
          <div key={c.id} className="relative">
            {d != null && <span className="absolute right-3 top-3 z-10 rounded-full bg-ink/85 px-2.5 py-1 text-xs font-semibold text-white">{fmt(d)}</span>}
            <CafeCard cafe={c} live={live[c.id]} />
          </div>
        ))}
      </div>

      {pages > 1 && (
        <nav aria-label="Halaman daftar kafe" className="mt-10 flex flex-col items-center gap-3">
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <button type="button" onClick={() => go(page - 1)} disabled={page === 1} aria-label="Halaman sebelumnya"
              className="grid h-11 w-11 place-items-center rounded-full border border-line bg-surface disabled:opacity-40">
              <Icon name="back" className="h-5 w-5" />
            </button>
            {pageList(page, pages).map((n, i) => n === "…"
              ? <span key={`e${i}`} className="px-1 text-muted" aria-hidden>…</span>
              : (
                <button key={n} type="button" onClick={() => go(n)} aria-label={`Halaman ${n}`} aria-current={n === page ? "page" : undefined}
                  className={`grid h-11 min-w-11 place-items-center rounded-full px-3 text-sm font-bold tabular-nums transition-colors ${n === page ? "bg-ink text-white" : "border border-line bg-surface hover:bg-tint"}`}>
                  {n}
                </button>
              ))}
            <button type="button" onClick={() => go(page + 1)} disabled={page === pages} aria-label="Halaman berikutnya"
              className="grid h-11 w-11 place-items-center rounded-full bg-ink text-white disabled:opacity-40">
              <Icon name="chevron" className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-muted">Kafe {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, list.length)} dari {list.length}</p>
        </nav>
      )}
    </>
  );
}
