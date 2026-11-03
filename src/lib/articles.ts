// Artikel SEO yang ditulis admin (tabel articles, migrasi 0026 + 0027).
// Kartu kafe disisipkan di isi artikel dengan [[kafe:slug]].

import { createPublicClient } from "./supabase/server";
import { CAFE_LIST_SELECT } from "./utils";
import type { Cafe } from "./types";

export type ManualArticle = {
  id: string; slug: string; title: string; excerpt: string | null; body: string; cover_url: string | null;
  city_id: string | null; is_published: boolean; published_at: string | null; updated_at: string; created_at: string;
  view_count?: number; like_count?: number;
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
