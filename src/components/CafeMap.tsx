"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AttributionControl, MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import { MAP_CENTER } from "@/lib/region";
import { isOpenNow } from "@/lib/utils";
import { CROWD, distanceM, reportAgo } from "@/lib/reports";
import type { OpeningHours } from "@/lib/types";
import Icon from "./Icon";

export type MapCafe = {
  slug: string; name: string; lat: number; lng: number; area: string | null; city: string;
  rating: number | null; price: string; cover: string | null; hours: OpeningHours | null;
  wifi: boolean; plug: boolean;
  live: { crowd: 1 | 2 | 3; mbps: number | null; at: string } | null;
};
type Pos = { lat: number; lng: number };

const CHIPS = [
  { key: "semua", label: "Semua" },
  { key: "sepi", label: "Sepi sekarang" },
  { key: "buka", label: "Buka sekarang" },
  { key: "wifi", label: "Wifi" },
  { key: "colokan", label: "Colokan" },
] as const;
type ChipKey = (typeof CHIPS)[number]["key"];

const CROWD_CHIP = { 1: "bg-[#eef6f1] text-[#2f7049]", 2: "bg-gold/15 text-[#8a5a00]", 3: "bg-[#b4533a]/10 text-[#8c3b25]" } as const;
const fmt = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace(".", ",")} km`);

// Pin tetesan: cokelat biasa, hijau kalau dilaporkan sepi 3 jam terakhir, emas & lebih besar untuk kafe yang dipilih
const pin = (fill: string, size: number) => L.divIcon({
  className: "",
  iconSize: [size, size * 1.25],
  iconAnchor: [size / 2, size * 1.25],
  html: `<svg viewBox="0 0 32 40" width="${size}" height="${size * 1.25}" style="filter:drop-shadow(0 2px 3px rgb(22 15 12 / .35))"><path d="M16 39s13-12.4 13-23A13 13 0 0 0 3 16c0 10.6 13 23 13 23Z" fill="${fill}" stroke="#fff" stroke-width="2.5"/><circle cx="16" cy="16" r="5" fill="#fff"/></svg>`,
});
const ICON = { base: pin("#6b4226", 30), sepi: pin("#2f7049", 30), active: pin("#e0a045", 42) };
const ME = L.divIcon({ className: "", iconSize: [56, 56], iconAnchor: [28, 28], html: '<span class="peta-me" aria-hidden="true"><i></i></span>' });

/** Menggerakkan peta: muat awal & ganti filter = tampilkan semua pin; geser kartu = terbang ke kafe itu. */
function MapSync({ cafes, active, follow, me }: { cafes: MapCafe[]; active: MapCafe | null; follow: boolean; me: Pos | null }) {
  const map = useMap();
  const key = cafes.map((c) => c.slug).sort().join(","); // urutan berubah (diurutkan dari lokasi) bukan alasan memperkecil peta
  useEffect(() => {
    if (!cafes.length) return;
    const pts = cafes.map((c) => [c.lat, c.lng] as [number, number]);
    if (pts.length === 1) map.setView(pts[0], 14);
    else map.fitBounds(pts, { paddingTopLeft: [40, 90], paddingBottomRight: [80, 240], maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  useEffect(() => {
    if (!active || !follow) return;
    // Lokasi saya aktif: tampilkan saya & kafe terpilih sekaligus, dengan garis jarak di antaranya
    if (me) { map.flyToBounds([[me.lat, me.lng], [active.lat, active.lng]], { paddingTopLeft: [48, 110], paddingBottomRight: [80, 250], maxZoom: 16, duration: 0.6 }); return; }
    // Geser sedikit ke atas supaya pin tidak tertutup kartu di bawah
    const z = Math.max(map.getZoom(), 14);
    const pt = map.project([active.lat, active.lng], z).add([0, 70]);
    map.flyTo(map.unproject(pt, z), z, { duration: 0.6 });
  }, [active, follow, me, map]);
  return null;
}

export default function CafeMap({ cafes }: { cafes: MapCafe[] }) {
  const [chip, setChip] = useState<ChipKey>("semua");
  const [active, setActive] = useState(0);
  const [follow, setFollow] = useState(false); // peta baru ikut kartu setelah pengguna menyentuh kartu/pin
  const [me, setMe] = useState<Pos | null>(null);
  const [locating, setLocating] = useState(false);
  const [locErr, setLocErr] = useState<string | null>(null);
  const track = useRef<HTMLDivElement>(null);

  const list = useMemo(() => {
    const out = cafes.filter((c) =>
      chip === "semua" ? true
      : chip === "sepi" ? c.live?.crowd === 1
      : chip === "buka" ? isOpenNow(c.hours) === true
      : chip === "wifi" ? c.wifi
      : c.plug);
    const withD = out.map((c) => ({ c, d: me ? distanceM(me, c) : null }));
    if (me) withD.sort((a, b) => a.d! - b.d!);
    return withD;
  }, [cafes, chip, me]);
  const current = list[active]?.c ?? null;

  // Pilihan berubah: kembali ke kartu pertama
  const listKey = list.map((i) => i.c.slug).join(",");
  useEffect(() => { track.current?.scrollTo({ left: 0 }); setActive(0); }, [listKey]);

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
    const touch = () => setFollow(true);
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("pointerdown", touch);
    el.addEventListener("wheel", touch, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); el.removeEventListener("pointerdown", touch); el.removeEventListener("wheel", touch); cancelAnimationFrame(raf); };
  }, []);

  const goTo = (i: number) => {
    setFollow(true);
    setActive(i);
    const el = track.current, ch = el?.children[i] as HTMLElement | undefined;
    if (el && ch) el.scrollTo({ left: ch.offsetLeft - (el.clientWidth - ch.offsetWidth) / 2, behavior: "smooth" });
  };

  const locate = () => {
    if (!navigator.geolocation) { setLocErr("Browser ini tidak bisa membaca lokasi."); return; }
    setLocating(true); setLocErr(null);
    navigator.geolocation.getCurrentPosition(
      (p) => { setMe({ lat: p.coords.latitude, lng: p.coords.longitude }); setFollow(true); setLocating(false); }, // kartu pertama = kafe terdekat, peta terbang ke sana
      () => { setLocErr("Lokasi tidak bisa dibaca. Izinkan akses lokasi di browser."); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  return (
    <div className="peta relative h-full w-full overflow-hidden">
      <MapContainer center={MAP_CENTER} zoom={7} zoomControl={false} attributionControl={false} scrollWheelZoom className="h-full w-full">
        <AttributionControl position="bottomright" prefix={false} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapSync cafes={list.map((i) => i.c)} active={current} follow={follow} me={me} />
        {list.map(({ c }, i) => (
          <Marker key={c.slug} position={[c.lat, c.lng]} title={c.name} alt={c.name}
            icon={i === active ? ICON.active : c.live?.crowd === 1 ? ICON.sepi : ICON.base}
            zIndexOffset={i === active ? 1000 : 0}
            eventHandlers={{ click: () => goTo(i) }} />
        ))}
        {me && <Marker position={[me.lat, me.lng]} icon={ME} interactive={false} keyboard={false} />}
        {me && current && (
          <Polyline positions={[[me.lat, me.lng], [current.lat, current.lng]]}
            pathOptions={{ color: "#160f0c", weight: 3, opacity: 0.7, dashArray: "2 8", lineCap: "round" }} />
        )}
      </MapContainer>

      {/* Filter cepat di atas peta */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] p-3">
        <div role="group" aria-label="Saring kafe di peta" className="pointer-events-auto -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
          {CHIPS.map((ch) => {
            const on = chip === ch.key;
            return (
              <button key={ch.key} type="button" aria-pressed={on} onClick={() => { setChip(ch.key); setFollow(false); }}
                className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-bold shadow-sm transition-colors ${on ? "border-espresso bg-espresso text-foam" : "border-line bg-surface text-ink hover:bg-tint"}`}>
                {ch.key === "sepi" && <span className="h-2 w-2 rounded-full bg-[#2f7049]" aria-hidden />}
                {ch.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tombol bulat di atas kartu */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[10.75rem] z-[1000] flex items-end justify-between px-3">
        <Link href="/kafe" aria-label="Lihat sebagai daftar" title="Lihat sebagai daftar"
          className="pointer-events-auto grid h-12 w-12 place-items-center rounded-full bg-surface text-ink shadow-md hover:bg-tint">
          <Icon name="grid" className="h-5 w-5" />
        </Link>
        <div className="flex flex-col items-end gap-2">
          {locErr && <p role="alert" className="pointer-events-auto max-w-56 rounded-2xl bg-surface px-3 py-2 text-xs shadow-md">{locErr}</p>}
          <button type="button" onClick={locate} disabled={locating} aria-label="Urutkan dari lokasi saya" title="Urutkan dari lokasi saya"
            className={`pointer-events-auto grid h-14 w-14 place-items-center rounded-full shadow-lg disabled:opacity-70 ${me ? "bg-gold text-espresso" : "bg-espresso text-foam"}`}>
            <Icon name="locate" className={`h-6 w-6 ${locating ? "motion-safe:animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Kartu kafe: geser untuk pindah, peta ikut ke kafe yang di tengah */}
      <div className="absolute inset-x-0 bottom-3 z-[1000]">
        {list.length === 0 ? (
          <div className="mx-3 flex items-center justify-between gap-3 rounded-3xl bg-surface p-4 shadow-lg">
            <p className="text-sm">{chip === "sepi" ? "Belum ada kafe yang dilaporkan sepi 3 jam terakhir." : "Tidak ada kafe yang cocok."}</p>
            <button type="button" onClick={() => setChip("semua")} className="btn-primary shrink-0">Tampilkan semua</button>
          </div>
        ) : (
          <div ref={track} aria-roledescription="carousel" aria-label="Kafe di peta"
            className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-[6%] [scrollbar-width:none] md:px-3">
            {list.map(({ c, d }, i) => {
              const open = isOpenNow(c.hours);
              const near = Math.abs(i - active) <= 3;
              return (
                <article key={c.slug} aria-label={`${c.name}, ${i + 1} dari ${list.length}`}
                  onMouseEnter={() => { if (i !== active) { setFollow(true); setActive(i); } }} onFocus={() => { setFollow(true); setActive(i); }}
                  className={`relative flex h-[9.5rem] w-[88%] max-w-sm shrink-0 snap-center gap-3 overflow-hidden rounded-3xl bg-surface p-2.5 shadow-lg transition-[outline-color] md:w-80 ${i === active ? "outline-2 outline-gold outline" : "outline-2 outline-transparent outline"}`}>
                  <div className="relative h-full w-[7.25rem] shrink-0 overflow-hidden rounded-2xl bg-tint">
                    {c.cover && near
                      ? <Image src={c.cover} alt="" fill sizes="120px" className="object-cover" />
                      : <div className="grid h-full place-items-center text-mist"><Icon name="cup" className="h-8 w-8" /></div>}
                    {d != null && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-gold px-2 py-0.5 text-xs font-extrabold text-espresso">{fmt(d)}</span>}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col py-0.5">
                    <p className="truncate text-xs font-semibold text-brand">{[c.area, c.city].filter(Boolean).join(" · ")}</p>
                    <h2 className="mt-0.5 line-clamp-2 font-sans text-base font-extrabold leading-snug tracking-normal">
                      <Link href={`/kafe/${c.slug}`} className="after:absolute after:inset-0 after:content-['']">{c.name}</Link>
                    </h2>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-muted">
                      {c.rating != null && <span className="flex items-center gap-0.5 text-ink"><Icon name="star" filled className="h-3.5 w-3.5 text-gold" />{c.rating.toFixed(1)}</span>}
                      <span>{c.price}</span>
                      {open !== null && <span className={open ? "text-[#2f7049]" : ""}>{open ? "Buka" : "Tutup"}</span>}
                    </p>
                    <div className="mt-auto flex items-end justify-between gap-2">
                      {c.live
                        ? <span title={`Dilaporkan ${reportAgo(c.live.at)}`} className={`truncate rounded-full px-2 py-1 text-[11px] font-bold ${CROWD_CHIP[c.live.crowd]}`}>{CROWD[c.live.crowd].label}{c.live.mbps != null ? ` · ${c.live.mbps} Mbps` : ""}</span>
                        : <span />}
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`} target="_blank" rel="noopener noreferrer"
                        aria-label={`Rute ke ${c.name} di Google Maps`} title="Rute di Google Maps"
                        className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-espresso text-foam hover:bg-ink">
                        <Icon name="send" className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
