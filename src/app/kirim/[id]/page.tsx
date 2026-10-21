import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import type { City, OpeningHours } from "@/lib/types";
import type { Amenities, Scores } from "@/lib/review";
import type { Submission, SubmissionData } from "@/lib/submission";
import SubmitForm from "../baru/SubmitForm";

export const metadata: Metadata = { title: "Edit rekomendasi kafe", robots: { index: false, follow: false } };

type LiveCafe = {
  id: string; slug: string; name: string; city_id: string; area: string | null; address: string | null;
  lat: number | null; lng: number | null; price_range: number; opening_hours: OpeningHours | null;
  menu_url: string | null; instagram: string | null; short_review: string | null; visited_at: string | null;
  scores: Scores | null; amenities: Amenities | null; contributor_id: string | null;
  city: { name: string } | null;
  details: { full_review: string | null; tips: string | null; best_time: string | null } | { full_review: string | null; tips: string | null; best_time: string | null }[] | null;
  menu: { name: string; price: number | null; note: string | null; is_must_try: boolean; sort_order: number }[];
  photos: { url: string; is_cover: boolean; sort_order: number }[];
};

export default async function EditSubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer.user) redirect(`/masuk?next=/kirim/${id}`);
  const supabase = await createClient();
  const [{ data: row }, { data: cities }] = await Promise.all([
    supabase.from("cafe_submissions").select("*").eq("id", id).eq("user_id", viewer.user.id).maybeSingle(),
    supabase.from("cities").select("*").order("name"),
  ]);
  const sub = row as Submission | null;
  if (!sub) notFound();

  // Sudah jadi kafe: isi form dari versi yang tayang (mungkin sudah dirapikan admin), bukan kiriman awal
  let data: SubmissionData = sub.data;
  let cafeSlug: string | null = null;
  if (sub.status === "approved") {
    // Kafe draf tidak terbaca lewat RLS pengunjung; kepemilikan sudah dicek lewat kiriman di atas
    const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase;
    const { data: c } = sub.cafe_id
      ? await db.from("cafes")
        .select("*, city:cities(name), details:cafe_details(full_review,tips,best_time), menu:menu_items(name,price,note,is_must_try,sort_order), photos:cafe_photos(url,is_cover,sort_order)")
        .eq("id", sub.cafe_id).maybeSingle()
      : { data: null };
    const cafe = c as LiveCafe | null;
    if (!cafe || cafe.contributor_id !== viewer.user.id) {
      return (
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <h1 className="text-3xl font-extrabold">Tidak bisa diedit</h1>
          <p className="mt-2 text-muted">Kafe dari rekomendasi ini sudah dihapus atau dipindahkan admin. Hubungi admin kalau ada yang perlu diperbaiki.</p>
          <Link href="/kirim" className="btn-primary mt-6">Kembali ke rekomendasi saya</Link>
        </div>
      );
    }
    const det = Array.isArray(cafe.details) ? cafe.details[0] : cafe.details;
    cafeSlug = cafe.slug;
    data = {
      ...sub.data,
      name: cafe.name, city_id: cafe.city_id, city_name: cafe.city?.name ?? sub.data.city_name,
      area: cafe.area, address: cafe.address, lat: cafe.lat, lng: cafe.lng,
      price_range: cafe.price_range, opening_hours: cafe.opening_hours && Object.keys(cafe.opening_hours).length ? cafe.opening_hours : null,
      menu_url: cafe.menu_url, instagram: cafe.instagram, short_review: cafe.short_review ?? sub.data.short_review,
      full_review: det?.full_review ?? null, tips: det?.tips ?? null, best_time: det?.best_time ?? null,
      visited_at: cafe.visited_at, scores: cafe.scores ?? {}, amenities: cafe.amenities ?? {},
      menu: [...(cafe.menu ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((m) => ({ name: m.name, price: m.price, note: m.note, is_must_try: m.is_must_try })),
      photos: [...(cafe.photos ?? [])].sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order).map((p) => p.url),
    };
  }

  const live = sub.status === "approved";
  const resubmit = sub.status === "rejected";
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href={cafeSlug ? `/kafe/${cafeSlug}` : "/kirim"} className="text-sm font-medium text-muted hover:text-brand">
        ← {cafeSlug ? "Halaman kafe" : "Rekomendasi saya"}
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold leading-tight md:text-4xl">Edit {data.name}</h1>
      <p className="mt-2 max-w-xl text-muted">
        {live ? "Kafe ini sudah tayang. Perubahan yang kamu simpan langsung tampil di halaman kafe."
          : resubmit ? "Perbaiki sesuai catatan admin, lalu kirim ulang untuk dicek lagi."
          : "Rekomendasi ini masih menunggu review. Perubahanmu ikut dicek admin."}
      </p>
      {resubmit && sub.admin_note && (
        <p className="mt-4 rounded-xl bg-tint px-4 py-3 text-sm"><span className="font-semibold">Catatan admin:</span> {sub.admin_note}</p>
      )}
      <div className="mt-8">
        <SubmitForm userId={viewer.user.id} defaultName={viewer.name ?? ""} cities={(cities as City[] | null) ?? []}
          initial={{ id: sub.id, data, authorName: sub.author_name, authorInstagram: sub.author_instagram, live, resubmit }} />
      </div>
    </div>
  );
}
