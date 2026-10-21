"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseCoords } from "@/lib/coords";
import { DAYS } from "@/lib/utils";
import { reviewFromForm } from "@/lib/review";
import { MAX_MENU, MAX_PHOTOS, RELATIONS, type Relation, type Submission, type SubmissionData, type SubmissionMenuItem } from "@/lib/submission";
import type { OpeningHours } from "@/lib/types";
import { tryAutoApprove } from "@/lib/autoApprove";
import { after } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveCityId } from "@/lib/submissionPublish";
import { averageScore } from "@/lib/review";
import { ensureThumbs } from "@/lib/thumbs";
import { mailConfigured, sendMail } from "@/lib/mail";
import { SITE_URL } from "@/lib/utils";

export type SubmitState = { error: string } | null;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const clean = (v: FormDataEntryValue | null, max = 500) => {
  const s = String(v ?? "").trim().slice(0, max);
  return s || null;
};

type Parsed = { data: SubmissionData; authorName: string; authorInstagram: string | null };

/**
 * Baca & validasi isian form rekomendasi (dipakai saat kirim baru dan saat mengedit).
 * `keepPhotos`: foto lama yang boleh tetap dipakai saat mengedit (selain unggahan baru di folder author).
 */
async function parseForm(supabase: Awaited<ReturnType<typeof createClient>>, user: User, f: FormData, keepPhotos: string[] = []): Promise<Parsed | { error: string }> {
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

  let cityName = cityOther ?? "";
  if (cityId) {
    const { data: city } = await supabase.from("cities").select("name").eq("id", cityId).maybeSingle();
    if (!city) return { error: "Kota tidak ditemukan. Pilih ulang kotanya." };
    cityName = city.name;
  }

  const coords = mapsLink ? parseCoords(mapsLink) : null;

  let hours: OpeningHours | null = null;
  if (f.get("know_hours") === "on") {
    hours = {};
    for (const { key } of DAYS) {
      const v = String(f.get(`hours_${key}`) ?? "");
      const m = v.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
      hours[key] = m ? [m[1], m[2]] : null;
    }
  }

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

  // Foto: hanya unggahan di folder milik author sendiri, atau foto lama kafe/kiriman ini
  const allowedPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/cafe-photos/submissions/${user.id}/`;
  let photos: string[] = [];
  try {
    photos = (JSON.parse(String(f.get("photos_json") || "[]")) as string[])
      .filter((u) => typeof u === "string" && (u.startsWith(allowedPrefix) || keepPhotos.includes(u)))
      .filter((u, i, a) => a.indexOf(u) === i)
      .slice(0, MAX_PHOTOS);
  } catch {
    photos = [];
  }

  const relation = (RELATIONS.find((r) => r.value === f.get("relation"))?.value ?? "pengunjung") as Relation;
  const price = Number(f.get("price_range"));
  const { scores, amenities } = reviewFromForm(f);

  return {
    authorName: authorName ?? "WFC Hunter",
    authorInstagram: clean(f.get("author_instagram"), 40)?.replace(/^@/, "") ?? null,
    data: {
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
    },
  };
}

export async function submitRecommendation(_prev: SubmitState, f: FormData): Promise<SubmitState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/masuk?next=/kirim/baru");

  // Batas kiriman supaya tidak dibanjiri spam
  const since = new Date(Date.now() - 864e5).toISOString();
  const [{ count: today }, { count: pending }] = await Promise.all([
    supabase.from("cafe_submissions").select("id", { count: "exact", head: true }).eq("user_id", user.id).gt("created_at", since),
    supabase.from("cafe_submissions").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "pending"),
  ]);
  if ((today ?? 0) >= 5) return { error: "Kamu sudah mengirim 5 rekomendasi hari ini. Lanjutkan besok ya." };
  if ((pending ?? 0) >= 15) return { error: "Masih ada 15 rekomendasimu yang menunggu review. Tunggu sebagian direview dulu ya." };

  const parsed = await parseForm(supabase, user, f);
  if ("error" in parsed) return parsed;

  const { data: inserted, error } = await supabase.from("cafe_submissions").insert({
    user_id: user.id,
    author_name: parsed.authorName,
    author_instagram: parsed.authorInstagram,
    data: parsed.data,
  }).select("id").single();
  if (error) {
    if (/cafe_submissions/.test(error.message) && /exist|find/.test(error.message))
      return { error: "Fitur ini belum aktif di database. Admin perlu menjalankan migrasi 0008." };
    return { error: `Gagal mengirim: ${error.message}` };
  }

  // Persetujuan otomatis (kalau dinyalakan admin): kiriman yang lolos semua cek langsung tayang
  const auto = await tryAutoApprove(inserted.id);
  revalidatePath("/kirim");
  redirect(auto.status === "published" ? `/kirim?terkirim=1&tayang=${encodeURIComponent(auto.slug)}` : "/kirim?terkirim=1");
}

/**
 * Author mengedit rekomendasinya sendiri.
 * - Menunggu review: isi kiriman diganti.
 * - Ditolak: isi diganti dan dikirim ulang (kembali menunggu review).
 * - Sudah jadi kafe: perubahan langsung tayang di halaman kafe; admin dikabari lewat email.
 */
export async function saveRecommendation(_prev: SubmitState, f: FormData): Promise<SubmitState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const id = String(f.get("submission_id") ?? "");
  if (!user) redirect(`/masuk?next=/kirim/${id}`);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: "Server belum siap menyimpan perubahan. Hubungi admin." };

  const db = createAdminClient();
  const { data: row } = await db.from("cafe_submissions").select("*").eq("id", id).maybeSingle();
  const sub = row as Submission | null;
  if (!sub || sub.user_id !== user.id) return { error: "Rekomendasi ini tidak ditemukan atau bukan milikmu." };

  // Kafe yang sudah tayang: pastikan memang kafe dari author ini
  let cafe: { id: string; slug: string; lat: number | null; lng: number | null; contributor_id: string | null } | null = null;
  let cafePhotos: { id: string; url: string }[] = [];
  if (sub.status === "approved") {
    if (!sub.cafe_id) return { error: "Kafe dari rekomendasi ini sudah dihapus admin, jadi tidak bisa diedit lagi." };
    const [{ data: c }, { data: ph }] = await Promise.all([
      db.from("cafes").select("id,slug,lat,lng,contributor_id").eq("id", sub.cafe_id).maybeSingle(),
      db.from("cafe_photos").select("id,url").eq("cafe_id", sub.cafe_id),
    ]);
    if (!c || c.contributor_id !== user.id) return { error: "Kafe ini bukan atas namamu, jadi tidak bisa diedit." };
    cafe = c; cafePhotos = ph ?? [];
  }

  const parsed = await parseForm(supabase, user, f, [...(sub.data.photos ?? []), ...cafePhotos.map((p) => p.url)]);
  if ("error" in parsed) return parsed;
  const d = parsed.data;
  // Link Maps tidak terbaca ulang: pakai titik lama supaya kafe tidak hilang dari peta
  if (d.lat == null) { d.lat = cafe?.lat ?? sub.data.lat ?? null; d.lng = cafe?.lng ?? sub.data.lng ?? null; }

  const subPatch = { data: d, author_name: parsed.authorName, author_instagram: parsed.authorInstagram };

  if (!cafe) {
    const resubmit = sub.status === "rejected";
    const { error } = await db.from("cafe_submissions")
      .update(resubmit ? { ...subPatch, status: "pending", admin_note: null, reviewed_at: null } : subPatch)
      .eq("id", sub.id);
    if (error) return { error: `Gagal menyimpan: ${error.message}` };
    const auto = resubmit ? await tryAutoApprove(sub.id) : { status: "off" as const };
    revalidatePath("/kirim");
    redirect(auto.status === "published" ? `/kirim?terkirim=1&tayang=${encodeURIComponent(auto.slug)}` : `/kirim?${resubmit ? "terkirim=1" : "disimpan=1"}`);
  }

  const city = await resolveCityId(db, d);
  if (typeof city !== "string") return city;
  const avg = averageScore(d.scores);
  const { error } = await db.from("cafes").update({
    name: d.name, city_id: city, area: d.area, address: d.address, lat: d.lat, lng: d.lng,
    price_range: d.price_range, opening_hours: d.opening_hours ?? {},
    my_rating: avg != null ? Math.round(avg * 10) / 10 : null,
    short_review: d.short_review, menu_url: d.menu_url, instagram: d.instagram, visited_at: d.visited_at,
    scores: d.scores ?? {}, amenities: d.amenities ?? {},
    contributor_name: parsed.authorName, contributor_instagram: parsed.authorInstagram,
  }).eq("id", cafe.id);
  if (error) return { error: `Gagal menyimpan: ${error.message}` };

  // Foto: hapus yang dibuang, urutkan ulang, tambah yang baru (foto pertama jadi sampul)
  const keep = new Map(cafePhotos.map((p) => [p.url, p.id]));
  const removed = cafePhotos.filter((p) => !d.photos.includes(p.url)).map((p) => p.id);
  await Promise.all([
    db.from("cafe_details").upsert({ cafe_id: cafe.id, full_review: d.full_review, tips: d.tips, best_time: d.best_time }),
    removed.length ? db.from("cafe_photos").delete().in("id", removed) : Promise.resolve(),
    ...d.photos.map((url, i) => keep.has(url)
      ? db.from("cafe_photos").update({ sort_order: i, is_cover: i === 0 }).eq("id", keep.get(url)!)
      : db.from("cafe_photos").insert({ cafe_id: cafe.id, url, sort_order: i, is_cover: i === 0 })),
    db.from("menu_items").delete().eq("cafe_id", cafe.id).then(() => d.menu.length
      ? db.from("menu_items").insert(d.menu.map((m, i) => ({ cafe_id: cafe.id, name: m.name, price: m.price, note: m.note, is_must_try: m.is_must_try, sort_order: i })))
      : null),
    db.from("cafe_submissions").update(subPatch).eq("id", sub.id),
  ]);
  if (d.photos.some((u) => !keep.has(u))) after(() => ensureThumbs({ cafeId: cafe.id, limit: 20 }));

  // Kabari admin supaya tetap bisa mengecek perubahan yang langsung tayang
  after(async () => {
    if (!mailConfigured()) return;
    try {
      const { data: admins } = await db.from("profiles").select("email").eq("role", "admin");
      const to = (admins ?? []).map((a) => a.email).filter(Boolean).join(",");
      const url = `${SITE_URL}/kafe/${cafe.slug}`;
      if (to) await sendMail({
        to,
        subject: `Diedit author: ${d.name} (oleh ${parsed.authorName})`,
        text: `${parsed.authorName} mengedit ${d.name} dan perubahannya sudah tayang: ${url}\nKalau perlu dirapikan: ${SITE_URL}/admin/kafe/${cafe.id}`,
        html: `<p><b>${esc(parsed.authorName)}</b> mengedit <b>${esc(d.name)}</b> dan perubahannya sudah tayang.</p><p><a href="${url}">Lihat halaman kafe</a> · <a href="${SITE_URL}/admin/kafe/${cafe.id}">Rapikan di admin</a></p>`,
      });
    } catch (e) { console.error("[saveRecommendation mail]", e); }
  });

  revalidateTag("authors");
  revalidatePath("/", "layout");
  redirect(`/kafe/${cafe.slug}?diedit=1`);
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
