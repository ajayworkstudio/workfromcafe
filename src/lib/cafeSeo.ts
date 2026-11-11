// Judul & deskripsi halaman kafe untuk hasil Google.
// Sebagian besar pencarian yang menampilkan halaman kafe berbunyi "menu <kafe>", "foto <kafe>", "ulasan <kafe>"
// (Search Console, Nov 2026), jadi judul dan deskripsi menjawab itu lebih dulu, lalu info kerja.
import type { Cafe, MenuItem } from "./types";
import { filledAspects, levelOf } from "./review";
import { clip } from "./seo";
import { priceLabel } from "./utils";

export type MenuPick = Pick<MenuItem, "name" | "price" | "is_must_try" | "sort_order">;

export const rpK = (p: number) => `Rp${(p / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}K`;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
// Nama aspek yang biasa diketik orang ("wifi"), bukan label panjang di kartu penilaian
const SHORT: Record<string, string> = { internet: "wifi", ketenangan: "suasana" };
const endSentence = (s: string) => (/[.!?…]$/.test(s) ? s : `${s}.`);

/** Nama kafe + kota, tanpa mengulang kota kalau sudah ada di nama ("November Coffee Semarang"). */
export function cafeWithCity(cafe: Pick<Cafe, "name" | "city">) {
  const city = cafe.city?.name;
  return city && !norm(cafe.name).includes(norm(city)) ? `${cafe.name} ${city}` : cafe.name;
}

export function cafeTitle(cafe: Pick<Cafe, "name" | "city">, menu: MenuPick[]) {
  return menu.length
    ? `Menu ${cafeWithCity(cafe)}: harga, foto & ulasan WFC`
    : `${cafeWithCity(cafe)}: foto, ulasan & info WFC`;
}

export function describeCafe(cafe: Cafe, menu: MenuPick[]) {
  const where = [cafe.area, cafe.city?.name].filter(Boolean).join(", ");
  const picks = [...menu]
    .filter((m) => m.price)
    .sort((a, b) => Number(b.is_must_try) - Number(a.is_must_try) || a.sort_order - b.sort_order)
    .slice(0, 3)
    .map((m) => `${m.name} ${rpK(m.price!)}`);
  const facts = filledAspects(cafe.scores)
    .filter((a) => ["internet", "colokan", "ketenangan"].includes(a.key))
    .map((a) => `${SHORT[a.key] ?? a.label.toLowerCase()} ${levelOf(a, a.score)[0].toLowerCase()}`)
    .join(", ");
  const factText = facts ? ` ${facts.charAt(0).toUpperCase()}${facts.slice(1)}.` : "";
  const lead = picks.length
    ? `Menu ${cafe.name}: ${picks.join(", ")}.`
    : endSentence(cafe.short_review?.trim() || `Review ${cafe.name} di ${where} untuk kerja, nugas, dan nongkrong`);
  return clip(`${lead} Harga ${priceLabel(cafe.price_range)} per orang.${factText} Foto, jam buka & ulasan dari kurator WFC Hunters.`);
}
