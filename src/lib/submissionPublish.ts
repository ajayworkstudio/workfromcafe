import { after } from "next/server";
import { ensureThumbs } from "./thumbs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { slugify } from "./utils";
import { averageScore } from "./review";
import { guessProvince, MAP_CENTER } from "./region";
import { autoUsername } from "./author";
import type { Submission, SubmissionData } from "./submission";

/** Kota: pakai yang dipilih, atau cari/buat dari nama kota (kota baru belum aktif). */
export async function resolveCityId(db: SupabaseClient, d: SubmissionData): Promise<string | { error: string }> {
  if (d.city_id) return d.city_id;
  const { data: found } = await db.from("cities").select("id").ilike("name", d.city_name).maybeSingle();
  if (found) return found.id as string;
  const { data: city, error } = await db.from("cities")
    .insert({ name: d.city_name, slug: slugify(d.city_name), province: guessProvince(d.lat, d.lng), lat: d.lat ?? MAP_CENTER[0], lng: d.lng ?? MAP_CENTER[1], is_active: false })
    .select("id").single();
  if (error) return { error: `Gagal membuat kota ${d.city_name}: ${error.message}` };
  return city.id as string;
}

/**
 * Buat kafe dari rekomendasi author (beserta detail, menu, foto), lalu tandai kiriman sebagai diterima.
 * Dipakai tombol "Terima" di admin (publish=false → draf) dan persetujuan otomatis (publish=true → langsung tayang).
 */
export async function createCafeFromSubmission(
  db: SupabaseClient,
  sub: Submission,
  opts: { publish: boolean; note: string | null },
): Promise<{ cafeId: string; slug: string } | { error: string }> {
  const d = sub.data;

  const city = await resolveCityId(db, d);
  if (typeof city !== "string") return city;
  const cityId = city;

  // Slug unik
  const base = slugify(d.name) || "kafe";
  let slug = base;
  for (let n = 2; n < 50; n++) {
    const { data: taken } = await db.from("cafes").select("id").eq("slug", slug).maybeSingle();
    if (!taken) break;
    slug = `${base}-${n}`;
  }

  const avg = averageScore(d.scores);
  const { data: cafe, error } = await db.from("cafes").insert({
    name: d.name,
    slug,
    city_id: cityId,
    area: d.area,
    address: d.address,
    lat: d.lat,
    lng: d.lng,
    price_range: d.price_range,
    opening_hours: d.opening_hours ?? {},
    my_rating: avg != null ? Math.round(avg * 10) / 10 : null,
    short_review: d.short_review,
    menu_url: d.menu_url,
    instagram: d.instagram,
    visited_at: d.visited_at,
    scores: d.scores ?? {},
    amenities: d.amenities ?? {},
    is_published: opts.publish,
    is_featured: false,
    contributor_id: sub.user_id,
    contributor_name: sub.author_name,
    contributor_instagram: sub.author_instagram,
  }).select("id").single();
  if (error) return { error: `Gagal membuat kafe: ${error.message}` };

  await Promise.all([
    db.from("cafe_details").upsert({ cafe_id: cafe.id, full_review: d.full_review, tips: d.tips, best_time: d.best_time }),
    d.menu?.length
      ? db.from("menu_items").insert(d.menu.map((m, i) => ({ cafe_id: cafe.id, name: m.name, price: m.price, note: m.note, is_must_try: m.is_must_try, sort_order: i })))
      : Promise.resolve(),
    d.photos?.length
      ? db.from("cafe_photos").insert(d.photos.map((url, i) => ({ cafe_id: cafe.id, url, is_cover: i === 0, sort_order: i })))
      : Promise.resolve(),
    // Kota otomatis aktif begitu punya kafe yang tayang
    opts.publish ? db.from("cities").update({ is_active: true }).eq("id", cityId) : Promise.resolve(),
  ]);

  // Pastikan author punya username untuk link profil publik
  const { data: prof } = await db.from("profiles").select("username,name").eq("id", sub.user_id).maybeSingle();
  if (prof && !prof.username) {
    await db.from("profiles").update({ username: autoUsername(prof.name || sub.author_name, sub.user_id) }).eq("id", sub.user_id);
  }

  await db.from("cafe_submissions").update({
    status: "approved", cafe_id: cafe.id, reviewed_at: new Date().toISOString(), admin_note: opts.note,
  }).eq("id", sub.id);

  // Thumbnail dibuat setelah respons terkirim supaya tombol Setujui tidak menunggu
  if (d.photos?.length) after(() => ensureThumbs({ cafeId: cafe.id, limit: 20 }));

  return { cafeId: cafe.id, slug };
}
