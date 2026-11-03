// Artikel SEO. Dua jenis:
// 1. Otomatis: disusun dari data kafe yang tayang (per kota, per kebutuhan kerja, per suasana). Tidak ada tabel;
//    artikel muncul sendiri begitu sebuah kota punya cukup kafe yang cocok, dan ikut berubah saat data berubah.
// 2. Manual: ditulis admin di tabel articles (migrasi 0026), boleh menyisipkan kartu kafe dengan [[kafe:slug]].

import { unstable_cache } from "next/cache";
import { createPublicClient } from "./supabase/server";
import { CAFE_LIST_SELECT, priceLabel } from "./utils";
import { ASPECTS, averageScore, cleanScore } from "./review";
import type { Cafe, City } from "./types";

/** Minimal kafe supaya sebuah topik layak jadi artikel (lebih sedikit dari ini = konten tipis). */
export const MIN_CAFES = 3;
const MAX_ITEMS = 10;

export type AutoArticle = {
  slug: string;
  kind: "terbaik" | "aspek" | "suasana" | "hemat";
  title: string;
  h1: string;
  description: string;
  intro: string;
  method: string;
  city: City;
  cafes: Cafe[];
  /** Kalimat sorotan per kafe, sesuai topik artikel */
  highlight: (c: Cafe) => string | null;
  faq: { q: string; a: string }[];
  updated: string;
  related: string[];
};

export type ManualArticle = {
  id: string; slug: string; title: string; excerpt: string | null; body: string; cover_url: string | null;
  city_id: string | null; is_published: boolean; published_at: string | null; updated_at: string; created_at: string;
};

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const score = (c: Cafe, key: string) => cleanScore((c.scores as Record<string, unknown> | null | undefined)?.[key]);
const aspect = (key: string) => ASPECTS.find((a) => a.key === key)!;
const levelText = (key: string, v: number) => aspect(key).levels[Math.min(5, Math.max(1, Math.round(v))) - 1][0].toLowerCase();

/** Skor kerja: rata-rata internet, colokan, ketenangan; kalau kosong pakai rating keseluruhan. */
function workScore(c: Cafe) {
  const parts = ["internet", "colokan", "ketenangan"].map((k) => score(c, k)).filter((v): v is number => v != null);
  if (parts.length) return parts.reduce((a, b) => a + b, 0) / parts.length;
  return c.my_rating != null ? Number(c.my_rating) : averageScore(c.scores) ?? 0;
}

const rating = (c: Cafe) => (c.my_rating != null ? Number(c.my_rating) : averageScore(c.scores));
const place = (c: Cafe) => c.area ?? c.city?.name ?? "";
const latest = (cs: Cafe[]) => cs.map((c) => (c as Cafe & { updated_at?: string }).updated_at ?? c.created_at).sort().at(-1) ?? new Date().toISOString();

function facts(c: Cafe) {
  const out: string[] = [];
  const i = score(c, "internet"), p = score(c, "colokan"), t = score(c, "ketenangan");
  if (i != null) out.push(`internet ${levelText("internet", i)}`);
  if (p != null) out.push(`colokan ${levelText("colokan", p)}`);
  if (t != null) out.push(`suasana ${levelText("ketenangan", t)}`);
  return out;
}

const ASPECT_TOPICS = [
  { key: "internet", slug: "wifi-kencang", noun: "wifi kencang", title: (city: string) => `Kafe dengan wifi kencang di ${city} buat meeting online` },
  { key: "colokan", slug: "banyak-colokan", noun: "banyak colokan", title: (city: string) => `Kafe dengan banyak colokan di ${city} buat kerja seharian` },
  { key: "ketenangan", slug: "tenang-buat-kerja", noun: "suasana tenang", title: (city: string) => `Kafe yang tenang buat fokus kerja di ${city}` },
] as const;

/** Semua artikel otomatis yang layak terbit dari data saat ini. */
function buildArticles(cafes: Cafe[], cities: City[]): AutoArticle[] {
  const out: AutoArticle[] = [];
  for (const city of cities) {
    const inCity = cafes.filter((c) => c.city_id === city.id);
    if (inCity.length < MIN_CAFES) continue;
    const mine: AutoArticle[] = [];
    const updated = latest(inCity);

    // 1. Terbaik untuk WFC
    const best = [...inCity].sort((a, b) => workScore(b) - workScore(a)).slice(0, MAX_ITEMS);
    const top = best[0];
    mine.push({
      slug: `kafe-wfc-terbaik-${city.slug}`, kind: "terbaik", city, cafes: best, updated,
      title: `${best.length} kafe terbaik buat WFC di ${city.name}`,
      h1: `${best.length} kafe terbaik buat kerja dan nugas di ${city.name}`,
      description: `Daftar kafe paling nyaman buat WFC di ${city.name}, diurutkan dari kecepatan internet, colokan, dan ketenangan. Termasuk ${best.slice(0, 3).map((c) => c.name).join(", ")}.`,
      intro: `Cari tempat kerja di luar rumah di ${city.name}? Dari ${inCity.length} kafe di ${city.name} yang sudah didatangi langsung oleh tim dan author WFC Hunters, ini ${best.length} yang paling enak dipakai kerja.`,
      method: "Urutannya dari rata-rata nilai internet, colokan, dan ketenangan yang diberikan saat kunjungan. Kafe yang belum dinilai per aspek memakai rating keseluruhannya.",
      highlight: (c) => facts(c).join(", ") || null,
      faq: [
        { q: `Kafe mana yang paling cocok buat WFC di ${city.name}?`, a: `${top.name}${place(top) ? ` di ${place(top)}` : ""} ada di urutan teratas${facts(top).length ? `, dengan ${facts(top).join(", ")}` : ""}.` },
        { q: `Berapa kisaran harga kafe kerja di ${city.name}?`, a: priceSpread(best) },
      ],
      related: [],
    });

    // 2. Per kebutuhan: wifi, colokan, ketenangan (nilai 4 ke atas)
    for (const t of ASPECT_TOPICS) {
      const fit = inCity.filter((c) => (score(c, t.key) ?? 0) >= 4).sort((a, b) => (score(b, t.key) ?? 0) - (score(a, t.key) ?? 0) || workScore(b) - workScore(a)).slice(0, MAX_ITEMS);
      if (fit.length < MIN_CAFES) continue;
      mine.push({
        slug: `kafe-${t.slug}-${city.slug}`, kind: "aspek", city, cafes: fit, updated,
        title: t.title(city.name), h1: t.title(city.name),
        description: `${fit.length} kafe di ${city.name} dengan ${t.noun}, dinilai langsung saat dikunjungi: ${fit.slice(0, 3).map((c) => c.name).join(", ")}, dan lainnya.`,
        intro: `Kalau yang paling kamu butuhkan ${t.noun}, ini ${fit.length} kafe di ${city.name} yang nilainya 4 dari 5 atau lebih untuk ${aspect(t.key).label.toLowerCase()}.`,
        method: `Hanya kafe dengan nilai ${aspect(t.key).label.toLowerCase()} minimal 4 dari 5 yang masuk. Kalau nilainya sama, yang lebih unggul di aspek kerja lain didahulukan.`,
        highlight: (c) => { const v = score(c, t.key); return v != null ? `${aspect(t.key).label}: ${levelText(t.key, v)} (${v.toLocaleString("id-ID")}/5)` : null; },
        faq: [{ q: `Kafe mana di ${city.name} yang ${t.noun}?`, a: `${fit.slice(0, 3).map((c) => c.name).join(", ")} termasuk yang nilainya paling tinggi.` }],
        related: [],
      });
    }

    // 3. Per suasana (tag bertipe vibe)
    const vibes = new Map<string, Cafe[]>();
    for (const c of inCity) for (const tg of c.tags ?? []) if (tg.tag?.type === "vibe") vibes.set(tg.tag.name, [...(vibes.get(tg.tag.name) ?? []), c]);
    for (const [name, list] of vibes) {
      // "WFC" dan "Tenang" sudah punya artikel sendiri (terbaik buat WFC, tenang buat kerja)
      if (list.length < MIN_CAFES || ["wfc", "tenang"].includes(slugify(name))) continue;
      const sorted = [...list].sort((a, b) => (rating(b) ?? 0) - (rating(a) ?? 0)).slice(0, MAX_ITEMS);
      mine.push({
        slug: `kafe-${slugify(name)}-${city.slug}`, kind: "suasana", city, cafes: sorted, updated,
        title: `Kafe ${name.toLowerCase()} di ${city.name} yang tetap enak buat kerja`,
        h1: `${sorted.length} kafe ${name.toLowerCase()} di ${city.name}`,
        description: `Rekomendasi kafe bersuasana ${name.toLowerCase()} di ${city.name} lengkap dengan info wifi, colokan, harga, dan menu: ${sorted.slice(0, 3).map((c) => c.name).join(", ")}.`,
        intro: `Suasana ${name.toLowerCase()} jadi pilihan buat yang bosan kerja di tempat yang itu-itu saja. Ini ${sorted.length} kafe di ${city.name} dengan suasana itu, lengkap dengan catatan buat kerja.`,
        method: `Kafe yang ditandai bersuasana ${name.toLowerCase()} oleh kurator, diurutkan dari rating keseluruhan.`,
        highlight: (c) => facts(c).join(", ") || null,
        faq: [],
        related: [],
      });
    }

    // 4. Hemat (kisaran harga termurah)
    const cheap = inCity.filter((c) => c.price_range <= 1).sort((a, b) => workScore(b) - workScore(a)).slice(0, MAX_ITEMS);
    if (cheap.length >= MIN_CAFES) {
      mine.push({
        slug: `kafe-murah-buat-nugas-${city.slug}`, kind: "hemat", city, cafes: cheap, updated,
        title: `Kafe murah buat nugas di ${city.name} (${priceLabel(1)})`,
        h1: `${cheap.length} kafe murah buat nugas di ${city.name}`,
        description: `Kafe di ${city.name} dengan kisaran harga ${priceLabel(1)} yang tetap nyaman buat nugas dan kerja: ${cheap.slice(0, 3).map((c) => c.name).join(", ")}.`,
        intro: `Kerja atau nugas di kafe tidak harus mahal. Ini ${cheap.length} kafe di ${city.name} dengan kisaran harga ${priceLabel(1)} per orang.`,
        method: `Kafe dengan kisaran harga paling rendah, diurutkan dari nilai kerjanya.`,
        highlight: (c) => facts(c).join(", ") || null,
        faq: [],
        related: [],
      });
    }

    for (const a of mine) a.related = mine.filter((b) => b.slug !== a.slug).map((b) => b.slug);
    out.push(...mine);
  }
  return out;
}

function priceSpread(cs: Cafe[]) {
  const ps = [...new Set(cs.map((c) => c.price_range))].sort();
  if (!ps.length) return "Belum ada data harga.";
  return ps.length === 1 ? `Umumnya ${priceLabel(ps[0])} per orang.` : `Mulai ${priceLabel(ps[0])} sampai ${priceLabel(ps.at(-1)!)} per orang.`;
}

/** Data dasar, di-cache 1 jam (revalidate ikut tag "cafes" kalau dipanggil). */
const loadData = unstable_cache(async () => {
  const db = createPublicClient();
  const [{ data: cafes, error: e1 }, { data: cities, error: e2 }] = await Promise.all([
    db.from("cafes").select(`${CAFE_LIST_SELECT}`).eq("is_published", true),
    db.from("cities").select("*").eq("is_active", true).order("name"),
  ]);
  // Gagal ambil data: lempar supaya hasil kosong tidak ikut tersimpan di cache selama sejam
  if (e1 || e2) throw new Error((e1 ?? e2)!.message);
  return { cafes: (cafes as Cafe[] | null) ?? [], cities: (cities as City[] | null) ?? [] };
}, ["artikel-data"], { revalidate: 3600, tags: ["cafes"] });

export async function getAutoArticles() {
  try {
    const { cafes, cities } = await loadData();
    return buildArticles(cafes, cities);
  } catch (e) {
    console.error("[artikel]", e);
    return [];
  }
}

export async function getManualArticles() {
  try {
    const { data } = await createPublicClient().from("articles").select("*").eq("is_published", true).order("published_at", { ascending: false });
    return (data as ManualArticle[] | null) ?? [];
  } catch {
    return [];
  }
}

export async function cafesBySlugs(slugs: string[]) {
  if (!slugs.length) return [];
  const { data } = await createPublicClient().from("cafes").select(CAFE_LIST_SELECT).in("slug", slugs).eq("is_published", true);
  return (data as Cafe[] | null) ?? [];
}

/** Slug kafe yang disisipkan di artikel manual dengan [[kafe:slug]]. */
export const embeddedSlugs = (body: string) => [...body.matchAll(/\[\[kafe:([\w-]+)\]\]/g)].map((m) => m[1]);
