import type { Cafe, DayKey, OpeningHours, Plan } from "./types";

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Ngopi Jateng";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const PLANS: Record<Plan, { label: string; months: number; price: number; note: string }> = {
  monthly: {
    label: "Bulanan",
    months: 1,
    price: Number(process.env.PRICE_MONTHLY || 25000),
    note: "Fleksibel, bisa berhenti kapan saja",
  },
  yearly: {
    label: "Tahunan",
    months: 12,
    price: Number(process.env.PRICE_YEARLY || 250000),
    note: "Hemat ~2 bulan",
  },
};

export const rupiah = (n: number | null | undefined) =>
  n == null ? "-" : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export const priceLabel = (p: number) => "Rp".repeat(Math.max(1, Math.min(4, p)));

export const DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Senin" },
  { key: "tue", label: "Selasa" },
  { key: "wed", label: "Rabu" },
  { key: "thu", label: "Kamis" },
  { key: "fri", label: "Jumat" },
  { key: "sat", label: "Sabtu" },
  { key: "sun", label: "Minggu" },
];

/** Waktu sekarang di zona Asia/Jakarta (WIB) — semua kota Jawa Tengah. */
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

export function isOpenNow(hours: OpeningHours | null | undefined): boolean | null {
  if (!hours || Object.keys(hours).length === 0) return null;
  const { day, time } = nowWIB();
  const slot = hours[day];
  if (!slot) return false;
  const [open, close] = slot;
  if (close <= open) return time >= open || time < close; // lewat tengah malam
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
