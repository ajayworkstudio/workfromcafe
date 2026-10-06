"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { EVENT_KINDS, wibToIso } from "@/lib/events";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;

export async function saveEvent(f: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = str(f, "id");
  const back = (msg: string) => redirect(`${id ? `/admin/event/${id}` : "/admin/event/baru"}?err=${encodeURIComponent(msg)}`);

  const title = str(f, "title");
  const starts = wibToIso(String(f.get("starts_at") ?? ""));
  if (!title) return back("Judul event wajib diisi.");
  if (!starts) return back("Tanggal & jam mulai wajib diisi.");
  const ends = wibToIso(String(f.get("ends_at") ?? ""));
  if (ends && ends < starts) return back("Jam selesai harus setelah jam mulai.");
  const kind = EVENT_KINDS.some((k) => k.value === f.get("kind")) ? String(f.get("kind")) : "lainnya";
  const quota = Number(f.get("quota")) || null;

  const row = {
    title,
    slug: slugify(str(f, "slug") || `${title}-${starts.slice(0, 10)}`),
    kind,
    starts_at: starts,
    ends_at: ends,
    city_id: str(f, "city_id"),
    cafe_id: str(f, "cafe_id"),
    venue: str(f, "venue"),
    description: str(f, "description"),
    cover_url: str(f, "cover_url"),
    register_url: str(f, "register_url"),
    quota: quota && quota > 0 ? Math.round(quota) : null,
    price: str(f, "price"),
    is_published: f.get("is_published") === "on",
  };

  let eventId = id;
  if (id) {
    const { error } = await supabase.from("events").update(row).eq("id", id);
    if (error) return back(friendly(error.message));
  } else {
    const { data, error } = await supabase.from("events").insert(row).select("id").single();
    if (error) return back(friendly(error.message));
    eventId = data.id;
  }
  revalidatePath("/event", "layout");
  revalidatePath("/admin/event");
  redirect(`/admin/event/${eventId}?ok=${encodeURIComponent(id ? "Perubahan disimpan." : "Event dibuat.")}`);
}

export async function deleteEvent(f: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("events").delete().eq("id", String(f.get("id")));
  revalidatePath("/event", "layout");
  redirect(`/admin/event?ok=${encodeURIComponent("Event dihapus.")}`);
}

function friendly(msg: string) {
  if (/events_slug_key|duplicate/.test(msg)) return "Alamat halaman (slug) sudah dipakai event lain.";
  if (/relation .*events|events.*does not exist|schema cache/.test(msg)) return "Tabel event belum ada. Jalankan migrasi 0013_event.sql di Supabase.";
  return msg;
}
