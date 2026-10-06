"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { averageScore } from "@/lib/review";
import { guessProvince, MAP_CENTER } from "@/lib/region";
import { autoUsername } from "@/lib/author";
import type { Submission } from "@/lib/submission";

/** Terima kiriman: buat kafe berstatus draf (belum tayang) lengkap dengan menu & foto, lalu buka form edit. */
export async function approveSubmission(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const back = (msg: string) => redirect(`/admin/rekomendasi/${id}?err=${encodeURIComponent(msg)}`);

  const { data: row } = await supabase.from("cafe_submissions").select("*").eq("id", id).maybeSingle();
  const sub = row as Submission | null;
  if (!sub) return back("Kiriman tidak ditemukan.");
  if (sub.status === "approved" && sub.cafe_id) redirect(`/admin/kafe/${sub.cafe_id}`);
  const d = sub.data;

  // Kota: pakai yang dipilih, atau cari/buat dari nama kota
  let cityId = d.city_id;
  if (!cityId) {
    const { data: found } = await supabase.from("cities").select("id").ilike("name", d.city_name).maybeSingle();
    if (found) cityId = found.id;
    else {
      const { data: city, error } = await supabase.from("cities")
        .insert({ name: d.city_name, slug: slugify(d.city_name), province: guessProvince(d.lat, d.lng), lat: d.lat ?? MAP_CENTER[0], lng: d.lng ?? MAP_CENTER[1], is_active: false })
        .select("id").single();
      if (error) return back(`Gagal membuat kota ${d.city_name}: ${error.message}`);
      cityId = city.id;
    }
  }

  // Slug unik
  const base = slugify(d.name) || "kafe";
  let slug = base;
  for (let n = 2; n < 50; n++) {
    const { data: taken } = await supabase.from("cafes").select("id").eq("slug", slug).maybeSingle();
    if (!taken) break;
    slug = `${base}-${n}`;
  }

  const avg = averageScore(d.scores);
  const { data: cafe, error } = await supabase.from("cafes").insert({
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
    is_published: false,
    is_featured: false,
    contributor_id: sub.user_id,
    contributor_name: sub.author_name,
    contributor_instagram: sub.author_instagram,
  }).select("id").single();
  if (error) return back(`Gagal membuat kafe: ${error.message}`);

  await Promise.all([
    supabase.from("cafe_details").upsert({ cafe_id: cafe.id, full_review: d.full_review, tips: d.tips, best_time: d.best_time }),
    d.menu?.length
      ? supabase.from("menu_items").insert(d.menu.map((m, i) => ({ cafe_id: cafe.id, name: m.name, price: m.price, note: m.note, is_must_try: m.is_must_try, sort_order: i })))
      : Promise.resolve(),
    d.photos?.length
      ? supabase.from("cafe_photos").insert(d.photos.map((url, i) => ({ cafe_id: cafe.id, url, is_cover: i === 0, sort_order: i })))
      : Promise.resolve(),
  ]);

  // Pastikan author punya username untuk link profil publik (setelah migrasi 0012)
  const { data: prof } = await supabase.from("profiles").select("username,name").eq("id", sub.user_id).maybeSingle();
  if (prof && !prof.username) {
    await supabase.from("profiles").update({ username: autoUsername(prof.name || sub.author_name, sub.user_id) }).eq("id", sub.user_id);
  }

  await supabase.from("cafe_submissions").update({
    status: "approved", cafe_id: cafe.id, reviewed_at: new Date().toISOString(), admin_note: String(formData.get("note") || "").trim() || null,
  }).eq("id", id);

  revalidateTag("authors");
  revalidatePath("/admin/rekomendasi");
  redirect(`/admin/kafe/${cafe.id}?ok=${encodeURIComponent(`Draf kafe dibuat dari rekomendasi ${sub.author_name}. Cek lokasi, rapikan, lalu centang Tayang.`)}`);
}

export async function rejectSubmission(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const note = String(formData.get("note") || "").trim().slice(0, 500);
  const { error } = await supabase.from("cafe_submissions")
    .update({ status: "rejected", admin_note: note || null, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  revalidateTag("authors");
  revalidatePath("/admin/rekomendasi");
  redirect(error
    ? `/admin/rekomendasi/${id}?err=${encodeURIComponent(error.message)}`
    : `/admin/rekomendasi?ok=${encodeURIComponent("Rekomendasi ditolak. Author bisa melihat catatanmu.")}`);
}
