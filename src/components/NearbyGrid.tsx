"use client";
import { useMemo, useState } from "react";
import CafeCard from "./CafeCard";
import Icon from "./Icon";
import type { Cafe } from "@/lib/types";

function km(a: [number, number], b: [number, number]) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const fmt = (d: number) => (d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(d < 10 ? 1 : 0)} km`);

/** Daftar kafe dengan tombol "Urutkan dari yang terdekat" (lokasi hanya dipakai di HP/browser, tidak dikirim ke server). */
export default function NearbyGrid({ cafes }: { cafes: Cafe[] }) {
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "denied" | "unsupported">("idle");

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

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {pos ? (
          <button onClick={() => setPos(null)} className="btn border border-brand bg-brand-soft text-brand !py-2"><Icon name="locate" className="h-4 w-4" />Diurutkan dari yang terdekat</button>
        ) : (
          <button onClick={locate} disabled={state === "loading"} className="btn-ghost !py-2"><Icon name="locate" className="h-4 w-4" />{state === "loading" ? "Mencari lokasimu…" : "Urutkan dari yang terdekat"}</button>
        )}
        {state === "denied" && <span className="text-sm text-muted">Izin lokasi ditolak. Aktifkan izin lokasi di browser, lalu coba lagi.</span>}
        {state === "unsupported" && <span className="text-sm text-muted">Browser ini tidak mendukung lokasi.</span>}
      </div>
      <div className="mt-6 grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
        {list.map(({ c, d }) => (
          <div key={c.id} className="relative">
            {d != null && <span className="absolute right-3 top-3 z-10 rounded-full bg-ink/85 px-2.5 py-1 text-xs font-semibold text-white">{fmt(d)}</span>}
            <CafeCard cafe={c} />
          </div>
        ))}
      </div>
    </>
  );
}
