"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseCoords } from "@/lib/coords";
import { DAYS } from "@/lib/utils";
import { reviewFromForm } from "@/lib/review";
import { MAX_MENU, MAX_PHOTOS, RELATIONS, type Relation, type SubmissionData, type SubmissionMenuItem } from "@/lib/submission";
import type { OpeningHours } from "@/lib/types";

export type SubmitState = { error: string } | null;

const clean = (v: FormDataEntryValue | null, max = 500) => {
  const s = String(v ?? "").trim().slice(0, max);
  return s || null;
};

export async function submitRecommendation(_prev: SubmitState, f: FormData): Promise<SubmitState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/masuk?next=/kirim/baru");

  // --- Validasi isian wajib
  const name = clean(f.get("name"), 120);
  // Nama author: isian form, kalau kosong pakai nama profil / awal email
  let authorName = clean(f.get("author_name"), 60);
  if (!authorName) {
    const { data: prof } = await supabase.from("profiles").select("name").eq("id", user.id).maybeSingle();
    authorName = prof?.name?.trim() || user.email?.split("@")[0] || "WFC Hunter";
  }
  const cityId = clean(f.get("city_id"), 60);
  const cityOther = clean(f.get("city_other"), 60);
  const shortReview = clean(f.get("short_review"), 200);
  const address = clean(f.get("address"), 300);
  const mapsLink = clean(f.get("maps_link"), 500);

  if (!name) return { error: "Nama kafe wajib diisi." };
  if (!cityId && !cityOther) return { error: "Pilih kota, atau tulis nama kotanya kalau tidak ada di daftar." };
  if (!address && !mapsLink) return { error: "Tempel link Google Maps (atau tulis alamatnya) supaya kafenya bisa ditemukan." };
  if (!shortReview || shortReview.length < 10) return { error: "Tulis satu kalimat kenapa kafe ini enak buat kerja (minimal 10 huruf)." };

  // --- Batas kiriman supaya tidak dibanjiri spam
  const since = new Date(Date.now() - 864e5).toISOString();
  const [{ count: today }, { count: pending }] = await Promise.all([
    supabase.from("cafe_submissions").select("id", { count: "exact", head: true }).eq("user_id", user.id).gt("created_at", since),
    supabase.from("cafe_submissions").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "pending"),
  ]);
  if ((today ?? 0) >= 5) return { error: "Kamu sudah mengirim 5 rekomendasi hari ini. Lanjutkan besok ya." };
  if ((pending ?? 0) >= 15) return { error: "Masih ada 15 rekomendasimu yang menunggu review. Tunggu sebagian direview dulu ya." };

  // --- Kota
  let cityName = cityOther ?? "";
  if (cityId) {
    const { data: city } = await supabase.from("cities").select("name").eq("id", cityId).maybeSingle();
    if (!city) return { error: "Kota tidak ditemukan. Pilih ulang kotanya." };
    cityName = city.name;
  }

  // --- Lokasi
  const coords = mapsLink ? parseCoords(mapsLink) : null;

  // --- Jam buka (opsional)
  let hours: OpeningHours | null = null;
  if (f.get("know_hours") === "on") {
    hours = {};
    for (const { key } of DAYS) {
      const v = String(f.get(`hours_${key}`) ?? "");
      const m = v.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
      hours[key] = m ? [m[1], m[2]] : null;
    }
  }

  // --- Menu
  let menu: SubmissionMenuItem[] = [];
  try {
    const raw = JSON.parse(String(f.get("menu_json") || "[]")) as Partial<SubmissionMenuItem & { price: string | number }>[];
    menu = raw
      .map((m) => ({
        name: String(m.name ?? "").trim().slice(0, 80),
        price: Number(String(m.price ?? "").replace(/\D/g, "")) || null,
        note: String(m.note ?? "").trim().slice(0, 160) || null,
        is_must_try: !!m.is_must_try,
      }))
      .filter((m) => m.name)
      .slice(0, MAX_MENU);
  } catch {
    return { error: "Daftar menu tidak terbaca. Coba muat ulang halaman." };
  }

  // --- Foto: hanya terima file yang diunggah ke folder milik author sendiri
  const allowedPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/cafe-photos/submissions/${user.id}/`;
  let photos: string[] = [];
  try {
    photos = (JSON.parse(String(f.get("photos_json") || "[]")) as string[])
      .filter((u) => typeof u === "string" && u.startsWith(allowedPrefix))
      .slice(0, MAX_PHOTOS);
  } catch {
    photos = [];
  }

  const relation = (RELATIONS.find((r) => r.value === f.get("relation"))?.value ?? "pengunjung") as Relation;
  const price = Number(f.get("price_range"));
  const { scores, amenities } = reviewFromForm(f);

  const data: SubmissionData = {
    name,
    city_id: cityId,
    city_name: cityName,
    area: clean(f.get("area"), 80),
    address,
    maps_link: mapsLink,
    lat: coords?.[0] ?? null,
    lng: coords?.[1] ?? null,
    price_range: price >= 1 && price <= 5 ? price : 2,
    opening_hours: hours,
    menu_url: clean(f.get("menu_url"), 500),
    instagram: clean(f.get("instagram"), 60)?.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/[/?#].*$/, "") ?? null,
    short_review: shortReview,
    full_review: clean(f.get("full_review"), 3000),
    tips: clean(f.get("tips"), 300),
    best_time: clean(f.get("best_time"), 120),
    visited_at: /^\d{4}-\d{2}-\d{2}$/.test(String(f.get("visited_at"))) ? String(f.get("visited_at")) : null,
    relation,
    scores,
    amenities,
    menu,
    photos,
  };

  const { error } = await supabase.from("cafe_submissions").insert({
    user_id: user.id,
    author_name: authorName,
    author_instagram: clean(f.get("author_instagram"), 40)?.replace(/^@/, "") ?? null,
    data,
  });
  if (error) {
    if (/cafe_submissions/.test(error.message) && /exist|find/.test(error.message))
      return { error: "Fitur ini belum aktif di database. Admin perlu menjalankan migrasi 0008." };
    return { error: `Gagal mengirim: ${error.message}` };
  }

  revalidatePath("/kirim");
  redirect("/kirim?terkirim=1");
}

/** Author menarik kiriman yang belum direview (beserta fotonya). */
export async function withdrawSubmission(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/masuk?next=/kirim");
  const id = String(formData.get("id"));
  const { data: sub } = await supabase.from("cafe_submissions").select("data,status").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (sub?.status === "pending") {
    const marker = "/cafe-photos/";
    const paths = ((sub.data as SubmissionData).photos ?? []).map((u) => u.slice(u.indexOf(marker) + marker.length)).filter(Boolean);
    if (paths.length) await supabase.storage.from("cafe-photos").remove(paths);
    await supabase.from("cafe_submissions").delete().eq("id", id).eq("user_id", user.id);
  }
  revalidatePath("/kirim");
  redirect("/kirim");
}
