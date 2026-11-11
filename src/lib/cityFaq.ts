// Pertanyaan umum di halaman kota, dijawab dari data kafe di kota itu (bukan teks karangan).
// Pertanyaan yang datanya tidak ada (mis. tidak ada kafe 24 jam) tidak ditampilkan.
import type { Cafe } from "./types";
import type { T } from "./i18n/core";
import { cleanScore } from "./review";
import { priceLabel } from "./utils";

export type FaqCafe = { name: string; slug: string };
export type Faq = { q: string; a: string; cafes: FaqCafe[] };

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function open24(c: Cafe) {
  if (c.tags?.some((x) => x.tag?.name === "Buka 24 Jam")) return true;
  const h = c.opening_hours;
  return !!h && DAYS.every((d) => h[d]?.[0] === "00:00" && h[d]?.[1] === "24:00");
}

const score = (c: Cafe, key: "internet" | "colokan" | "ketenangan") => cleanScore(c.scores?.[key]) ?? 0;
const pick = (list: Cafe[]): FaqCafe[] => list.slice(0, 5).map((c) => ({ name: c.name, slug: c.slug }));

export function cityFaqs(place: string, all: Cafe[], t: T, locale: string): Faq[] {
  const cafes = all.filter((c) => c.is_published);
  if (!cafes.length) return [];
  const list = (xs: string[]) => new Intl.ListFormat(locale, { type: "conjunction" }).format(xs);
  const rating = (r: number) => r.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const out: Faq[] = [];

  const top = cafes.filter((c) => c.my_rating != null).sort((a, b) => b.my_rating! - a.my_rating!).slice(0, 3);
  if (top.length) {
    out.push({
      q: t("Cafe mana yang paling direkomendasikan untuk WFC di {place}?", { place }),
      a: t("Nilai tertinggi dari kurator WFC Hunters: {list}.", { list: list(top.map((c) => `${c.name} (${rating(c.my_rating!)})`)) }),
      cafes: pick(top),
    });
  }

  const fast = cafes.filter((c) => score(c, "internet") >= 4 && score(c, "colokan") >= 4);
  if (fast.length) {
    out.push({
      q: t("Cafe di {place} yang wifinya kencang dan banyak colokan?", { place }),
      a: t("{list}. Penilaian internet dan colokan keduanya 4 dari 5 atau lebih.", { list: list(fast.slice(0, 5).map((c) => c.name)) }),
      cafes: pick(fast),
    });
  }

  const quiet = cafes.filter((c) => score(c, "ketenangan") >= 4);
  if (quiet.length) {
    out.push({
      q: t("Cafe yang tenang untuk nugas di {place}?", { place }),
      a: t("{list}. Penilaian ketenangannya 4 dari 5 atau lebih.", { list: list(quiet.slice(0, 5).map((c) => c.name)) }),
      cafes: pick(quiet),
    });
  }

  const allDay = cafes.filter(open24);
  if (allDay.length) {
    out.push({
      q: t("Ada cafe di {place} yang buka 24 jam?", { place }),
      a: t("Ada: {list}.", { list: list(allDay.slice(0, 5).map((c) => c.name)) }),
      cafes: pick(allDay),
    });
  }

  const byPrice = new Map<number, number>();
  for (const c of cafes) byPrice.set(c.price_range, (byPrice.get(c.price_range) ?? 0) + 1);
  const [common, k] = [...byPrice.entries()].sort((a, b) => b[1] - a[1])[0];
  out.push({
    q: t("Berapa kisaran harga cafe untuk kerja di {place}?", { place }),
    a: t("Paling banyak di kisaran {price} per orang ({k} dari {n} kafe).", { price: t(priceLabel(common)), k, n: cafes.length }),
    cafes: [],
  });

  return out;
}
