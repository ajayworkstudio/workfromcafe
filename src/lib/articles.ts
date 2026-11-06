// Artikel SEO yang ditulis admin (tabel articles, migrasi 0026 + 0027).
// Kartu kafe disisipkan di isi artikel dengan [[kafe:slug]].

import { createPublicClient } from "./supabase/server";
import { CAFE_LIST_SELECT, coverUrl } from "./utils";
import type { Cafe } from "./types";

export type ManualArticle = {
  id: string; slug: string; title: string; excerpt: string | null; body: string; cover_url: string | null;
  city_id: string | null; is_published: boolean; published_at: string | null; updated_at: string; created_at: string;
  view_count?: number; like_count?: number;
  meta_title?: string | null; meta_description?: string | null; cover_alt?: string | null;
  line_spacing?: string | null; paragraph_spacing?: string | null;
};

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

/** Slug kafe yang disisipkan di artikel dengan [[kafe:slug]]. */
export const embeddedSlugs = (body: string) => [...body.matchAll(/\[\[kafe:([\w-]+)\]\]/g)].map((m) => m[1]);

/** Artikel tayang yang menyisipkan kafe ini (untuk laporan owner dan halaman kafe). */
export async function articlesWithCafe(slug: string) {
  return (await getManualArticles()).filter((a) => embeddedSlugs(a.body).includes(slug));
}

/** Perkiraan waktu baca dari jumlah kata (200 kata per menit), minimal 1 menit. */
export function readingMinutes(body: string) {
  const words = body.replace(/\[\[kafe:[\w-]+\]\]|!\[[^\]]*\]\([^)]*\)|\[(?:kiri|tengah|kanan)\]|[#*_[\]()>-]/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Foto untuk kartu artikel: sampul, gambar pertama di isi, lalu foto kafe pertama yang disisipkan. */
export async function articleCovers(articles: ManualArticle[]) {
  const firstSlug = (a: ManualArticle) => embeddedSlugs(a.body).at(0);
  const need = [...new Set(articles.filter((a) => !a.cover_url).map(firstSlug).filter((s): s is string => !!s))];
  const cafes = await cafesBySlugs(need);
  const bySlug = new Map(cafes.map((c) => [c.slug, coverUrl(c)]));
  return new Map(articles.map((a) => {
    const inBody = a.body.match(/^(?:\[(?:kiri|tengah|kanan)\][ \t]*)?!\[[^\]]*\]\(((?:https:\/\/|\/)[^\s)]+)\)$/m)?.[1];
    const s = firstSlug(a);
    return [a.id, a.cover_url || inBody || (s ? bySlug.get(s) ?? null : null)];
  }));
}

/** Nama kota per id, untuk label kategori artikel. */
export async function cityNames() {
  const { data } = await createPublicClient().from("cities").select("id,name");
  return new Map(((data as { id: string; name: string }[] | null) ?? []).map((c) => [c.id, c.name]));
}
