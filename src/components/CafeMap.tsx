"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import FadeImage from "./FadeImage";
import { AttributionControl, MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import { MAP_CENTER } from "@/lib/region";
import { isOpenNow } from "@/lib/utils";
import { CROWD, distanceM, reportAgo } from "@/lib/reports";
import type { OpeningHours } from "@/lib/types";
import Icon from "./Icon";
import { useT } from "@/components/I18nProvider";

export type MapCafe = {
  slug: string; name: string; lat: number; lng: number; area: string | null; city: string; citySlug: string;
  rating: number | null; price: string; cover: string | null; hours: OpeningHours | null;
  wifi: boolean; plug: boolean;
  live: { crowd: 1 | 2 | 3; mbps: number | null; at: string } | null;
};
type Pos = { lat: number; lng: number };
type Item = { c: MapCafe; d: number | null };
type City = { slug: string; name: string; count: number; lat: number; lng: number };

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
// Di bawah zoom ini (peta selebar beberapa kota) pin diganti gelembung per kota supaya tidak menumpuk
const CITY_ZOOM = 10;

// Pin tetesan: cokelat biasa, hijau kalau dilaporkan sepi 3 jam terakhir, emas & lebih besar untuk kafe yang dipilih
const pin = (fill: string, size: number) => L.divIcon({
  className: "",
  iconSize: [size, size * 1.25],
  iconAnchor: [size / 2, size * 1.25],
  html: `<svg viewBox="0 0 32 40" width="${size}" height="${size * 1.25}" style="filter:drop-shadow(0 2px 3px rgb(22 15 12 / .35))"><path d="M16 39s13-12.4 13-23A13 13 0 0 0 3 16c0 10.6 13 23 13 23Z" fill="${fill}" stroke="#fff" stroke-width="2.5"/><circle cx="16" cy="16" r="5" fill="#fff"/></svg>`,
});
const ICON = { base: pin("#6b4226", 30), sepi: pin("#2f7049", 30), active: pin("#e0a045", 42) };
const ME = L.divIcon({ className: "", iconSize: [56, 56], iconAnchor: [28, 28], html: '<span class="peta-me" aria-hidden="true"><i></i></span>' });
const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
const cityIcon = (label: string, count: number) => L.divIcon({
  className: "",
  iconSize: [0, 0],
  html: `<span class="peta-kota"><b>${count}</b>${esc(label)}</span>`,
});

function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

/** Menggerakkan peta: daftar berubah = tampilkan semua pin; pilih kafe = terbang ke sana. */
function MapSync({ cafes, active, follow, me, wide, onZoom }: {
  cafes: MapCafe[]; active: MapCafe | null; follow: boolean; me: Pos | null; wide: boolean; onZoom: (z: number) => void;
}) {
  const map = useMap();
  useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  // Di HP kartu menutupi bagian bawah peta; di layar lebar daftar ada di samping, bukan di atas peta
  const padBR: [number, number] = wide ? [60, 60] : [60, 230];
  const key = cafes.map((c) => c.slug).sort().join(","); // urutan berubah (diurutkan dari lokasi) bukan alasan memperkecil peta
  useEffect(() => {
    map.invalidateSize();
    if (!cafes.length) return;
    const pts = cafes.map((c) => [c.lat, c.lng] as [number, number]);
    if (pts.length === 1) map.setView(pts[0], 15);
    else map.fitBounds(pts, { paddingTopLeft: [40, wide ? 40 : 120], paddingBottomRight: padBR, maxZoom: 15 });
    onZoom(map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map, wide]);
  useEffect(() => {
    if (!active || !follow) return;
    // Lokasi saya aktif: tampilkan saya & kafe terpilih sekaligus, dengan garis jarak di antaranya
    if (me) { map.flyToBounds([[me.lat, me.lng], [active.lat, active.lng]], { paddingTopLeft: [48, wide ? 48 : 130], paddingBottomRight: padBR, maxZoom: 16, duration: 0.6 }); return; }
    const z = Math.max(map.getZoom(), 15);
    // Di HP geser sedikit ke atas supaya pin tidak tertutup kartu di bawah
    const pt = map.project([active.lat, active.lng], z).add([0, wide ? 0 : 70]);
    map.flyTo(map.unproject(pt, z), z, { duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, follow, me, map, wide]);
  return null;
}

/** Gelembung per kota. Kota yang berdekatan di layar (Semarang, Ungaran, Kendal) digabung jadi
 *  "Semarang +2"; diketuk = peta memperbesar ke area itu, gelembung satu kota = masuk ke kota itu. */
function CityBubbles({ cities, zoom, onCity }: { cities: City[]; zoom: number; onCity: (slug: string) => void }) {
  const map = useMap();
  const { t } = useT();
  const groups = useMemo(() => {
    const out: { lead: City; members: City[]; count: number }[] = [];
    for (const c of cities) { // urut dari kafe terbanyak, jadi kota terbesar jadi nama gelembung
      const p = map.project([c.lat, c.lng], zoom);
      const g = out.find((x) => {
        const q = map.project([x.lead.lat, x.lead.lng], zoom);
        return Math.abs(q.x - p.x) < 130 && Math.abs(q.y - p.y) < 44; // kira-kira ukuran satu gelembung
      });
      if (g) { g.members.push(c); g.count += c.count; } else out.push({ lead: c, members: [c], count: c.count });
    }
    return out;
  }, [cities, zoom, map]);
  return groups.map((g) => {
    const more = g.members.length - 1;
    const label = more ? `${g.lead.name} +${more}` : g.lead.name;
    return (
      <Marker key={g.lead.slug} position={[g.lead.lat, g.lead.lng]} icon={cityIcon(label, g.count)} zIndexOffset={g.count}
        title={more ? g.members.map((m) => m.name).join(", ") : t("Kafe di {place}", { place: g.lead.name })}
        eventHandlers={{
          click: () => more
            ? map.flyToBounds(g.members.map((m) => [m.lat, m.lng] as [number, number]), { padding: [90, 90], maxZoom: CITY_ZOOM + 1, duration: 0.6 })
            : onCity(g.lead.slug),
        }} />
    );
  });
}

/** Tombol pilih kota dengan daftar kota yang punya kafe di peta. */
function CityPicker({ cities, value, total, onChange, className = "" }: {
  cities: City[]; value: string; total: number; onChange: (slug: string) => void; className?: string;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", key); };
  }, [open]);
  const current = cities.find((c) => c.slug === value);
  const pick = (slug: string) => { onChange(slug); setOpen(false); };
  return (
    <div ref={box} className={`relative ${className}`}>
      <button type="button" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center gap-2 rounded-full border border-line bg-surface pl-3 pr-4 text-sm font-bold shadow-sm transition-colors hover:bg-tint">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-espresso text-foam"><Icon name="pin" className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1 truncate text-left">{current ? current.name : t("Semua kota")}</span>
        <Icon name="chevronDown" className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="group" aria-label={t("Pilih kota")}
          className="absolute left-0 top-full z-[1200] mt-2 max-h-[min(60vh,26rem)] w-72 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-3xl border border-line bg-surface p-1.5 shadow-xl">
          {[{ slug: "", name: t("Semua kota"), count: total }, ...cities].map((c) => {
            const on = c.slug === value;
            return (
              <button key={c.slug || "semua"} type="button" aria-pressed={on} onClick={() => pick(c.slug)}
                className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl px-3.5 text-left text-sm transition-colors ${on ? "bg-espresso font-bold text-foam" : "font-semibold hover:bg-tint"}`}>
                <span className="truncate">{c.name}</span>
                <span className={`shrink-0 tabular-nums ${on ? "text-foam/75" : "text-muted"}`}>{t("{n} kafe", { n: c.count })}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chips({ chip, setChip, wrap = false }: { chip: ChipKey; setChip: (k: ChipKey) => void; wrap?: boolean }) {
  const { t } = useT();
  return (
    <div role="group" aria-label={t("Saring kafe di peta")}
      className={wrap ? "flex flex-wrap gap-2" : "-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]"}>
      {CHIPS.map((ch) => {
        const on = chip === ch.key;
        return (
          <button key={ch.key} type="button" aria-pressed={on} onClick={() => setChip(ch.key)}
            className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-bold shadow-sm transition-colors ${on ? "border-espresso bg-espresso text-foam" : "border-line bg-surface text-ink hover:bg-tint"}`}>
            {ch.key === "sepi" && <span className={`h-2 w-2 rounded-full ${on ? "bg-[#7fd19f]" : "bg-[#2f7049]"}`} aria-hidden />}
            {t(ch.label)}
          </button>
        );
      })}
    </div>
  );
}

/** Satu baris kafe di daftar samping (layar lebar) dan di lembar daftar (HP). */
function Row({ item, active, onSelect, onHover }: { item: Item; active: boolean; onSelect: () => void; onHover?: () => void }) {
  const { t, locale } = useT();
  const { c, d } = item;
  const open = isOpenNow(c.hours);
  return (
    <li data-slug={c.slug} className={`group relative rounded-3xl transition-colors ${active ? "bg-gold/15 ring-2 ring-gold" : "hover:bg-tint"}`}>
      <button type="button" onClick={onSelect} onMouseEnter={onHover} aria-current={active || undefined}
        className="flex w-full items-center gap-3 rounded-3xl p-2 pr-14 text-left">
        <span className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-2xl bg-tint">
          {c.cover
            ? <FadeImage src={c.cover} alt="" fill sizes="72px" className="object-cover" />
            : <span className="grid h-full place-items-center text-mist"><Icon name="cup" className="h-6 w-6" /></span>}
          {d != null && <span className="absolute bottom-1 left-1 rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-extrabold text-espresso">{fmt(d)}</span>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-brand">{[c.area, c.city].filter(Boolean).join(" · ")}</span>
          <span className="mt-0.5 block truncate text-[15px] font-extrabold leading-snug">{c.name}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-muted">
            {c.rating != null && <span className="flex items-center gap-0.5 text-ink"><Icon name="star" filled className="h-3.5 w-3.5 text-gold" />{c.rating.toFixed(1)}</span>}
            <span>{t(c.price)}</span>
            {open !== null && <span className={open ? "text-[#2f7049]" : ""}>{open ? t("Buka") : t("Tutup")}</span>}
            {c.live && (
              <span title={t("Dilaporkan {when}", { when: reportAgo(c.live.at, t, locale) })} className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${CROWD_CHIP[c.live.crowd]}`}>
                {t(CROWD[c.live.crowd].label)}{c.live.mbps != null ? ` · ${c.live.mbps} Mbps` : ""}
              </span>
            )}
          </span>
        </span>
      </button>
      <Link href={`/kafe/${c.slug}`} aria-label={t("Buka ulasan")} title={t("Buka ulasan")}
        className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-ink transition-colors hover:bg-espresso hover:text-foam">
        <Icon name="arrow" className="h-5 w-5" />
      </Link>
    </li>
  );
}

function EmptyState({ chip, onReset }: { chip: ChipKey; onReset: () => void }) {
  const { t } = useT();
  return (
    <div className="flex items-center justify-between gap-3 rounded-3xl bg-surface p-4">
      <p className="text-sm">{chip === "sepi" ? t("Belum ada kafe yang dilaporkan sepi 3 jam terakhir.") : t("Tidak ada kafe yang cocok.")}</p>
      <button type="button" onClick={onReset} className="btn-primary shrink-0">{t("Tampilkan semua")}</button>
    </div>
  );
}

export default function CafeMap({ cafes, autoLocate = false, initialCity = "" }: { cafes: MapCafe[]; autoLocate?: boolean; initialCity?: string }) {
  const { t, locale } = useT();
  const wide = useWide();
  const [chip, setChipState] = useState<ChipKey>("semua");
  const [city, setCityState] = useState(cafes.some((c) => c.citySlug === initialCity) ? initialCity : "");
  const [q, setQ] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [follow, setFollow] = useState(false); // peta baru ikut setelah pengguna memilih kafe
  const [zoom, setZoom] = useState(7);
  const [sheet, setSheet] = useState(false);
  const [me, setMe] = useState<Pos | null>(null);
  const [locating, setLocating] = useState(false);
  const [locErr, setLocErr] = useState<string | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLUListElement>(null);

  // Kota yang punya kafe di peta, terbanyak dulu; titik gelembung = rata-rata posisi kafenya
  const cities = useMemo(() => {
    const m = new Map<string, City>();
    for (const c of cafes) {
      if (!c.citySlug) continue;
      const x = m.get(c.citySlug) ?? { slug: c.citySlug, name: c.city, count: 0, lat: 0, lng: 0 };
      x.count++; x.lat += c.lat; x.lng += c.lng;
      m.set(c.citySlug, x);
    }
    return [...m.values()].map((x) => ({ ...x, lat: x.lat / x.count, lng: x.lng / x.count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [cafes]);

  const list: Item[] = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = cafes.filter((c) =>
      (!city || c.citySlug === city)
      && (!needle || `${c.name} ${c.area ?? ""}`.toLowerCase().includes(needle))
      && (chip === "semua" ? true
        : chip === "sepi" ? c.live?.crowd === 1
        : chip === "buka" ? isOpenNow(c.hours) === true
        : chip === "wifi" ? c.wifi
        : c.plug));
    const withD = out.map((c) => ({ c, d: me ? distanceM(me, c) : null }));
    if (me) withD.sort((a, b) => a.d! - b.d!);
    return withD;
  }, [cafes, city, q, chip, me]);

  const activeIdx = Math.max(0, list.findIndex((i) => i.c.slug === active));
  const current = list[activeIdx]?.c ?? null;
  // Gelembung kota dihitung dari daftar yang sedang tersaring
  const bubbles = useMemo(() => {
    if (city || zoom >= CITY_ZOOM) return [];
    const slugs = new Set(list.map((i) => i.c.citySlug));
    const counts = new Map<string, number>();
    for (const { c } of list) counts.set(c.citySlug, (counts.get(c.citySlug) ?? 0) + 1);
    const out = cities.filter((x) => slugs.has(x.slug)).map((x) => ({ ...x, count: counts.get(x.slug)! }));
    return out.length > 1 ? out : [];
  }, [list, cities, city, zoom]);

  const setChip = (k: ChipKey) => { setChipState(k); setFollow(false); };
  const setCity = (slug: string) => {
    setCityState(slug); setFollow(false); setQ("");
    const url = new URL(window.location.href);
    if (slug) url.searchParams.set("kota", slug); else url.searchParams.delete("kota");
    window.history.replaceState(null, "", url);
  };

  // Daftar berubah: kembali ke kafe pertama
  const listKey = list.map((i) => i.c.slug).join(",");
  useEffect(() => {
    track.current?.scrollTo({ left: 0 });
    panel.current?.parentElement?.scrollTo({ top: 0 });
    setActive(list[0]?.c.slug ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey]);

  // HP: kartu yang di tengah carousel = kafe terpilih
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
        const slug = (el.children[best] as HTMLElement | undefined)?.dataset.slug;
        if (slug) setActive(slug);
      });
    };
    const touch = () => setFollow(true);
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("pointerdown", touch);
    el.addEventListener("wheel", touch, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); el.removeEventListener("pointerdown", touch); el.removeEventListener("wheel", touch); cancelAnimationFrame(raf); };
  }, [wide, list.length]);

  /** Pilih kafe dari pin, baris daftar, atau kartu: peta terbang, kartu/baris ikut digulir. */
  const select = (slug: string) => {
    setFollow(true);
    setActive(slug);
    setSheet(false);
    requestAnimationFrame(() => {
      const el = track.current, ch = el?.querySelector<HTMLElement>(`[data-slug="${slug}"]`);
      if (el && ch) el.scrollTo({ left: ch.offsetLeft - (el.clientWidth - ch.offsetWidth) / 2, behavior: "smooth" });
      panel.current?.querySelector<HTMLElement>(`[data-slug="${slug}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  };

  const locate = () => {
    if (!navigator.geolocation) { setLocErr(t("Browser ini tidak bisa membaca lokasi.")); return; }
    setLocating(true); setLocErr(null);
    navigator.geolocation.getCurrentPosition(
      (p) => { setMe({ lat: p.coords.latitude, lng: p.coords.longitude }); setFollow(true); setLocating(false); }, // kafe pertama = terdekat, peta terbang ke sana
      () => { setLocErr(t("Lokasi tidak bisa dibaca. Izinkan akses lokasi di browser.")); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };
  useEffect(() => {
    if (!sheet) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setSheet(false); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [sheet]);
  // Dibuka dari tombol "Kafe terdekat" di beranda: langsung minta lokasi sekali
  useEffect(() => { if (autoLocate) locate(); }, [autoLocate]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => { setChip("semua"); setQ(""); };
  const cityName = cities.find((c) => c.slug === city)?.name;
  const heading = cityName ? t("Kafe di {place}", { place: cityName }) : t("Peta kafe");

  const locateBtn = (
    <div className="flex flex-col items-end gap-2">
      {locErr && <p role="alert" className="pointer-events-auto max-w-56 rounded-2xl bg-surface px-3 py-2 text-xs shadow-md">{locErr}</p>}
      <button type="button" onClick={locate} disabled={locating} aria-label={t("Urutkan dari lokasi saya")} title={t("Urutkan dari lokasi saya")}
        className={`pointer-events-auto grid h-14 w-14 place-items-center rounded-full shadow-lg disabled:opacity-70 ${me ? "bg-gold text-espresso" : "bg-espresso text-foam"}`}>
        <Icon name="locate" className={`h-6 w-6 ${locating ? "motion-safe:animate-spin" : ""}`} />
      </button>
    </div>
  );

  return (
    <div className="peta relative flex h-full w-full overflow-hidden">
      {/* Layar lebar: daftar kafe di samping peta */}
      {wide && (
        <aside className="flex w-[25rem] shrink-0 flex-col border-r border-line bg-canvas xl:w-[27rem]">
          <div className="space-y-3 border-b border-line px-5 pb-4 pt-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="truncate text-2xl font-extrabold">{heading}</h2>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-muted">{t("{n} kafe", { n: list.length })}</p>
            </div>
            <CityPicker cities={cities} value={city} total={cafes.length} onChange={setCity} />
            <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-line bg-surface px-3.5 focus-within:ring-2 focus-within:ring-gold">
              <Icon name="search" className="h-4 w-4 shrink-0 text-muted" />
              <span className="sr-only">{t("Cari nama kafe atau area")}</span>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Cari nama kafe atau area")}
                className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted" />
            </label>
            <Chips chip={chip} setChip={setChip} wrap />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {list.length === 0
              ? <EmptyState chip={chip} onReset={reset} />
              : (
                <ul ref={panel} aria-label={t("Kafe di peta")} className="space-y-1">
                  {list.map((item) => (
                    <Row key={item.c.slug} item={item} active={item.c.slug === current?.slug} onSelect={() => select(item.c.slug)} />
                  ))}
                </ul>
              )}
          </div>
        </aside>
      )}

      <div className="relative min-w-0 flex-1">
        <MapContainer center={MAP_CENTER} zoom={7} zoomControl={false} attributionControl={false} scrollWheelZoom className="h-full w-full">
          <AttributionControl position="bottomright" prefix={false} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapSync cafes={list.map((i) => i.c)} active={current} follow={follow} me={me} wide={wide} onZoom={setZoom} />
          {bubbles.length > 0
            ? <CityBubbles cities={bubbles} zoom={zoom} onCity={setCity} />
            : list.map(({ c }) => {
                const on = c.slug === current?.slug;
                return (
                  <Marker key={c.slug} position={[c.lat, c.lng]} title={c.name} alt={c.name}
                    icon={on ? ICON.active : c.live?.crowd === 1 ? ICON.sepi : ICON.base}
                    zIndexOffset={on ? 1000 : 0}
                    eventHandlers={{ click: () => select(c.slug) }} />
                );
              })}
          {me && <Marker position={[me.lat, me.lng]} icon={ME} interactive={false} keyboard={false} />}
          {me && current && bubbles.length === 0 && (
            <Polyline positions={[[me.lat, me.lng], [current.lat, current.lng]]}
              pathOptions={{ color: "#160f0c", weight: 3, opacity: 0.7, dashArray: "2 8", lineCap: "round" }} />
          )}
        </MapContainer>

        {wide ? (
          <div className="pointer-events-none absolute bottom-6 right-4 z-[1000]">{locateBtn}</div>
        ) : (
          <>
            {/* HP: pilih kota dan filter di atas peta */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] space-y-2 p-3">
              <div className="pointer-events-auto flex gap-2">
                <CityPicker cities={cities} value={city} total={cafes.length} onChange={setCity} className="min-w-0 flex-1" />
                <button type="button" onClick={() => setSheet(true)} aria-label={t("Lihat sebagai daftar")}
                  className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm font-bold shadow-sm hover:bg-tint">
                  <Icon name="list" className="h-4 w-4" />{t("Daftar kafe")}
                </button>
              </div>
              <div className="pointer-events-auto"><Chips chip={chip} setChip={setChip} /></div>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-[10.75rem] z-[1000] flex justify-end px-3">{locateBtn}</div>

            {/* HP: kartu kafe digeser, peta ikut ke kafe yang di tengah */}
            <div className="absolute inset-x-0 bottom-3 z-[1000]">
              {list.length === 0 ? (
                <div className="mx-3 shadow-lg"><EmptyState chip={chip} onReset={reset} /></div>
              ) : (
                <div ref={track} aria-roledescription="carousel" aria-label={t("Kafe di peta")}
                  className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-[6%] [scrollbar-width:none]">
                  {list.map(({ c, d }, i) => {
                    const open = isOpenNow(c.hours);
                    const on = c.slug === current?.slug;
                    const near = Math.abs(i - activeIdx) <= 3;
                    return (
                      <article key={c.slug} data-slug={c.slug} aria-label={`${c.name}, ${i + 1} / ${list.length}`}
                        onFocus={() => select(c.slug)}
                        className={`relative flex h-[9.5rem] w-[88%] max-w-sm shrink-0 snap-center gap-3 overflow-hidden rounded-3xl bg-surface p-2.5 shadow-lg outline outline-2 transition-[outline-color] ${on ? "outline-gold" : "outline-transparent"}`}>
                        <div className="relative h-full w-[7.25rem] shrink-0 overflow-hidden rounded-2xl bg-tint">
                          {c.cover && near
                            ? <FadeImage src={c.cover} alt="" fill sizes="120px" className="object-cover" />
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
                            <span>{t(c.price)}</span>
                            {open !== null && <span className={open ? "text-[#2f7049]" : ""}>{open ? t("Buka") : t("Tutup")}</span>}
                          </p>
                          <div className="mt-auto flex items-end justify-between gap-2">
                            {c.live
                              ? <span title={t("Dilaporkan {when}", { when: reportAgo(c.live.at, t, locale) })} className={`truncate rounded-full px-2 py-1 text-[11px] font-bold ${CROWD_CHIP[c.live.crowd]}`}>{t(CROWD[c.live.crowd].label)}{c.live.mbps != null ? ` · ${c.live.mbps} Mbps` : ""}</span>
                              : <span />}
                            <a href={`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`} target="_blank" rel="noopener noreferrer"
                              aria-label={t("Rute ke {name} di Google Maps", { name: c.name })} title={t("Rute di Google Maps")}
                              className="relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-espresso text-foam hover:bg-ink">
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

            {/* HP: lembar daftar lengkap dari bawah */}
            {sheet && (
              <div className="absolute inset-0 z-[1100] flex flex-col justify-end">
                <button type="button" aria-label={t("Tutup daftar")} onClick={() => setSheet(false)} className="absolute inset-0 bg-espresso/40" />
                <div role="dialog" aria-modal="true" aria-label={heading}
                  className="relative flex max-h-[85%] flex-col rounded-t-[2rem] bg-canvas shadow-2xl motion-safe:animate-[rise_.25s_ease-out]">
                  <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-extrabold">{heading}</h2>
                      <p className="text-sm font-semibold text-muted">{t("{n} kafe", { n: list.length })}</p>
                    </div>
                    <button type="button" onClick={() => setSheet(false)} aria-label={t("Tutup daftar")}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface hover:bg-tint">
                      <Icon name="x" className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-1">
                    {list.length === 0
                      ? <EmptyState chip={chip} onReset={reset} />
                      : (
                        <ul className="space-y-1">
                          {list.map((item) => (
                            <Row key={item.c.slug} item={item} active={item.c.slug === current?.slug} onSelect={() => select(item.c.slug)} />
                          ))}
                        </ul>
                      )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
