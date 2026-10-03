import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/utils";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/kafe`, changeFrequency: "daily" },
    { url: `${SITE_URL}/harga`, changeFrequency: "monthly" },
  ];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return base;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const [{ data: cafes }, { data: cities }] = await Promise.all([
    supabase.from("cafes").select("slug,updated_at"),
    supabase.from("cities").select("slug").eq("is_active", true),
  ]);
  return [
    ...base,
    ...(cities ?? []).map((c) => ({ url: `${SITE_URL}/kota/${c.slug}`, changeFrequency: "weekly" as const })),
    ...(cafes ?? []).map((c) => ({ url: `${SITE_URL}/kafe/${c.slug}`, lastModified: c.updated_at })),
  ];
}
