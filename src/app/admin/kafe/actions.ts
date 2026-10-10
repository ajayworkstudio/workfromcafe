"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { notifyAuthorLevel } from "@/lib/levelNotify";
import { DAYS, slugify } from "@/lib/utils";
import type { OpeningHours } from "@/lib/types";
import { averageScore, reviewFromForm } from "@/lib/review";

const str = (f: FormData, k: string) => ((f.get(k) as string) ?? "").trim() || null;

type WriteResult = { cafeId: string; myRating: number | null; mailNote: string | null } | { error: string };

/** Simpan isi form kafe ke database. Dipakai oleh tombol Simpan dan simpan otomatis. */
async function writeCafe(formData: FormData): Promise<WriteResult> {
  const supabase = await createClient();
  const id = str(formData, "id");
  const name = String(formData.get("name")).trim();
  const num = (k: string) => (str(formData, k) ? Number(formData.get(k)) : null);

  const hours: OpeningHours = {};
  for (const { key } of DAYS) {
    const v = str(formData, `hours_${key}`); // "closed" | "HH:MM-HH:MM"
    const m = v?.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
    hours[key] = m ? [m[1], m[2]] : null;
  }

  const { scores, amenities } = reviewFromForm(formData);
  const avg = averageScore(scores);

  const cafe = {
    name,
    slug: slugify(str(formData, "slug") || name),
    city_id: String(formData.get("city_id")),
    area: str(formData, "area"),
    address: str(formData, "address"),
    lat: num("lat"),
    lng: num("lng"),
    price_range: Number(formData.get("price_range") || 2),
    // Rating keseluruhan: isian manual menang; kosong (atau masih sama dengan rata-rata lama) = rata-rata baru
    my_rating: (() => {
      const manual = num("my_rating");
      const prev = num("prev_avg");
      const auto = avg != null ? Math.round(avg * 10) / 10 : null;
      if (manual == null || (prev != null && Math.abs(manual - prev) < 0.05)) return auto ?? manual;
      return manual;
    })(),
    scores,
    amenities,
    short_review: str(formData, "short_review"),
    menu_url: str(formData, "menu_url"),
    instagram: str(formData, "instagram")?.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, "") ?? null,
    is_featured: formData.get("is_featured") === "on",
    is_published: formData.get("is_published") === "on",
    visited_at: str(formData, "visited_at"),
    opening_hours: hours,
  };

  let cafeId = id;
  if (id) {
    const { error } = await supabase.from("cafes").update(cafe).eq("id", id);
    if (error) return { error: friendly(error.message) };
  } else {
    const { data, error } = await supabase.from("cafes").insert(cafe).select("id").single();
    if (error) return { error: friendly(error.message) };
    cafeId = data!.id;
  }

  await supabase.from("cafe_details").upsert({
    cafe_id: cafeId,
    full_review: str(formData, "full_review"),
    tips: str(formData, "tips"),
    best_time: str(formData, "best_time"),
  });

  const tagIds = formData.getAll("tags").map(String);
  await supabase.from("cafe_tags").delete().eq("cafe_id", cafeId!);
  if (tagIds.length) await supabase.from("cafe_tags").insert(tagIds.map((tag_id) => ({ cafe_id: cafeId, tag_id })));

  // Kota otomatis aktif begitu punya kafe yang tayang
  if (cafe.is_published) await supabase.from("cities").update({ is_active: true }).eq("id", cafe.city_id);

  // Kabari author lewat email kalau kafe ini membuatnya naik level
  const { data: owner } = await supabase.from("cafes").select("contributor_id").eq("id", cafeId!).maybeSingle();
  const mailNote = await notifyAuthorLevel(owner?.contributor_id);

  revalidateTag("authors");
  revalidatePath("/", "layout");
  return { cafeId: cafeId!, myRating: cafe.my_rating, mailNote };
}

export async function saveCafe(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const res = await writeCafe(formData);
  if ("error" in res) redirect(`/admin/kafe/${id ?? "baru"}?err=${encodeURIComponent(res.error)}`);
  const okMsg = id ? "Perubahan disimpan." : "Kafe dibuat. Sekarang tambahkan foto dan menu.";
  redirect(`/admin/kafe/${res.cafeId}?ok=${encodeURIComponent(res.mailNote ? `${okMsg} ${res.mailNote}` : okMsg)}`);
}

export type AutosaveResult = { ok: true; savedAt: string; myRating: number | null; note: string | null } | { ok: false; error: string };

/** Simpan otomatis saat admin mengedit kafe yang sudah ada (tanpa pindah halaman). */
export async function autosaveCafe(formData: FormData): Promise<AutosaveResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Sesi admin habis. Masuk lagi, lalu tekan Simpan perubahan." };
  }
  if (!str(formData, "id")) return { ok: false, error: "Kafe baru disimpan dengan tombol Simpan kafe." };
  if (!str(formData, "name")) return { ok: false, error: "Nama kafe masih kosong, jadi belum disimpan." };
  try {
    const res = await writeCafe(formData);
    if ("error" in res) return { ok: false, error: res.error };
    // Simpan otomatis jalan berkali-kali: tampilkan catatan email hanya kalau email benar-benar terkirim
    return { ok: true, savedAt: new Date().toISOString(), myRating: res.myRating, note: res.mailNote?.includes("terkirim") ? res.mailNote : null };
  } catch (e) {
    console.error("[autosaveCafe]", e);
    return { ok: false, error: "Gangguan server saat menyimpan. Coba lagi sebentar lagi." };
  }
}

function friendly(msg: string) {
  if (/scores|amenities/.test(msg) && /column/.test(msg)) return "Database belum diperbarui. Jalankan migrasi 0007_penilaian_fasilitas_gratis.sql di Supabase SQL Editor.";
  if (msg.includes("cafes_slug_key")) return "Slug URL sudah dipakai kafe lain. Ganti nama atau slug-nya.";
  return msg;
}

export async function deleteCafe(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id"));
  // Hapus file foto di storage juga
  const { data: files } = await supabase.storage.from("cafe-photos").list(id, { limit: 1000 });
  const { data: menuFiles } = await supabase.storage.from("cafe-photos").list(`${id}/menu`, { limit: 1000 });
  const paths = [...(files ?? []).filter((f) => f.id).map((f) => `${id}/${f.name}`), ...(menuFiles ?? []).map((f) => `${id}/menu/${f.name}`)];
  if (paths.length) await supabase.storage.from("cafe-photos").remove(paths);
  await supabase.from("cafes").delete().eq("id", id);
  revalidateTag("authors");
  revalidatePath("/", "layout");
  redirect("/admin/kafe?ok=" + encodeURIComponent("Kafe dihapus."));
}

export async function toggleCafeFlag(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const field = String(formData.get("field"));
  if (field !== "is_published" && field !== "is_featured") return;
  await supabase.from("cafes").update({ [field]: formData.get("value") === "true" }).eq("id", String(formData.get("id")));
  if (field === "is_published") {
    const { data: owner } = await supabase.from("cafes").select("contributor_id").eq("id", String(formData.get("id"))).maybeSingle();
    await notifyAuthorLevel(owner?.contributor_id);
  }
  revalidateTag("authors");
  revalidatePath("/", "layout");
}
