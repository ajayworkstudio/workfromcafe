import type { Cafe, DayKey, OpeningHours } from "./types";

export const APP_NAME = "WorkFromCafe";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const rupiah = (n: number | null | undefined) =>
  n == null ? "-" : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

/** Kisaran harga per orang. Nilai 1–5 disimpan di kolom cafes.price_range. */
export const PRICE_RANGES: { value: number; label: string }[] = [
  { value: 1, label: "Rp10K–30K" },
  { value: 2, label: "Rp20K–40K" },
  { value: 3, label: "Rp30K–50K" },
  { value: 4, label: "Rp40K–60K" },
  { value: 5, label: "Rp60K ke atas" },
];

export const priceLabel = (p: number) => PRICE_RANGES.find((r) => r.value === p)?.label ?? "-";

export const DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Senin" },
  { key: "tue", label: "Selasa" },
  { key: "wed", label: "Rabu" },
  { key: "thu", label: "Kamis" },
  { key: "fri", label: "Jumat" },
  { key: "sat", label: "Sabtu" },
  { key: "sun", label: "Minggu" },
];

/** Waktu sekarang di zona Asia/Jakarta (WIB) — semua kota di Pulau Jawa. */
function nowWIB() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = get("weekday").toLowerCase().slice(0, 3) as DayKey;
  const hh = get("hour") === "24" ? "00" : get("hour");
  return { day, time: `${hh}:${get("minute")}` };
}

export const isAllDay = (slot: [string, string] | null | undefined) =>
  !!slot && slot[0] === "00:00" && (slot[1] === "24:00" || slot[1] === "23:59");

export const formatSlot = (slot: [string, string] | null | undefined) =>
  !slot ? "Tutup" : isAllDay(slot) ? "24 jam" : `${slot[0]}–${slot[1]}`;

export function isOpenNow(hours: OpeningHours | null | undefined): boolean | null {
  if (!hours || Object.keys(hours).length === 0) return null;
  const { day, time } = nowWIB();
  const order: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const prev = hours[order[(order.indexOf(day) + 6) % 7]];
  // Masih buka dari jadwal kemarin yang lewat tengah malam (mis. Jumat 18:00–02:00, sekarang Sabtu 01:00)
  if (prev && !isAllDay(prev) && prev[1] <= prev[0] && time < prev[1]) return true;
  const slot = hours[day];
  if (!slot) return false;
  if (isAllDay(slot)) return true;
  const [open, close] = slot;
  if (close <= open) return time >= open; // buka sampai lewat tengah malam
  return time >= open && time < close;
}

export function coverUrl(cafe: Pick<Cafe, "photos">): string | null {
  const photos = cafe.photos ?? [];
  const cover = photos.find((p) => p.is_cover) ?? [...photos].sort((a, b) => a.sort_order - b.sort_order)[0];
  return cover?.url ?? null;
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const CAFE_LIST_SELECT =
  "*, city:cities(*), photos:cafe_photos(id,url,is_cover,sort_order), tags:cafe_tags(tag:tags(*))";

/** "baru saja", "5 menit lalu", "3 hari lalu", lalu tanggal untuk yang lebih lama. */
export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("id", { numeric: "auto" });
  if (s < 60) return "baru saja";
  if (s < 3600) return rtf.format(-Math.floor(s / 60), "minute");
  if (s < 86400) return rtf.format(-Math.floor(s / 3600), "hour");
  if (s < 86400 * 7) return rtf.format(-Math.floor(s / 86400), "day");
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
}
