import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/utils";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/kafe`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/peta`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/author`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE_URL}/kirim`, changeFrequency: "monthly", priority: 0.4 },
  ];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return base;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const [{ data: cafes }, { data: cities }, { data: authors }, { data: events }] = await Promise.all([
    supabase.from("cafes").select("slug,updated_at,city_id").eq("is_published", true),
    supabase.from("cities").select("id,slug").eq("is_active", true),
    supabase.rpc("authors_list"),
    supabase.from("events").select("slug,updated_at").eq("is_published", true), // kosong selama menu Event terkunci (RLS)
  ]);

  // Tanggal terakhir berubah per kota = kafe terbaru di kota itu
  const cityUpdated = new Map<string, string>();
  for (const c of cafes ?? []) {
    const prev = cityUpdated.get(c.city_id);
    if (!prev || c.updated_at > prev) cityUpdated.set(c.city_id, c.updated_at);
  }

  return [
    ...base,
    ...(cities ?? [])
      .filter((c) => cityUpdated.has(c.id))
      .map((c) => ({ url: `${SITE_URL}/kota/${c.slug}`, lastModified: cityUpdated.get(c.id), changeFrequency: "weekly" as const, priority: 0.8 })),
    ...(cafes ?? []).map((c) => ({ url: `${SITE_URL}/kafe/${c.slug}`, lastModified: c.updated_at, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...(events?.length ? [{ url: `${SITE_URL}/event`, changeFrequency: "weekly" as const, priority: 0.6 }] : []),
    ...(events ?? []).map((e) => ({ url: `${SITE_URL}/event/${e.slug}`, lastModified: e.updated_at, changeFrequency: "weekly" as const, priority: 0.5 })),
    ...((authors as { id: string; username: string | null; last_at: string }[] | null) ?? []).map((a) => ({
      url: `${SITE_URL}/author/${a.username ?? a.id}`, lastModified: a.last_at, changeFrequency: "monthly" as const, priority: 0.4,
    })),
  ];
}
