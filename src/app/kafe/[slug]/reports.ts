"use server";
import { notifyCafeActivity } from "@/lib/notify";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CROWD, PLUGS, REPORT_RADIUS_M, distanceM } from "@/lib/reports";
import { getViewer } from "@/lib/auth";

export type ReportInput = {
  cafeId: string; slug: string;
  crowd: number; plugs: number | null; note: string;
  download: number | null; upload: number | null; ping: number | null;
  lat: number | null; lng: number | null; accuracy: number | null;
};
export type ReportResult = { ok: true } | { ok: false; error: string; code?: "login" | "far" | "limit" | "setup" };

const num = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v * 10) / 10 : null);

export async function submitReport(input: ReportInput): Promise<ReportResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Masuk dulu untuk melapor.", code: "login" };

  const crowd = Number(input.crowd);
  if (![1, 2, 3].includes(crowd)) return { ok: false, error: "Pilih seramai apa kafenya sekarang." };
  const plugs = [1, 2, 3].includes(Number(input.plugs)) ? Number(input.plugs) : null;
  const note = String(input.note ?? "").replace(/\s+/g, " ").trim().slice(0, 140) || null;
  // Catatan singkat, bukan tempat promosi
  if (note && (/(https?:\/\/|www\.|\.com\b|\.id\b)/i.test(note) || /(\+62|08)\d{7,}/.test(note.replace(/[\s-]/g, "")))) {
    return { ok: false, error: "Catatan tidak boleh berisi link atau nomor telepon." };
  }

  const { data: cafe } = await supabase.from("cafes").select("id,lat,lng,is_published").eq("id", input.cafeId).maybeSingle();
  if (!cafe?.is_published) return { ok: false, error: "Kafe ini tidak ditemukan." };

  // Harus di dekat kafe. Toleransi mengikuti akurasi GPS HP (maksimal 200 m tambahan).
  let distance: number | null = null;
  // Admin boleh melapor dari mana saja (untuk mencoba fitur); laporannya bisa dihapus dari halaman kafe
  const { isAdmin } = await getViewer();
  if (cafe.lat != null && cafe.lng != null && !isAdmin) {
    const lat = Number(input.lat), lng = Number(input.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, error: "Izinkan akses lokasi supaya laporan bisa dikirim.", code: "far" };
    distance = Math.round(distanceM({ lat, lng }, { lat: Number(cafe.lat), lng: Number(cafe.lng) }));
    const slack = Math.min(Math.max(Number(input.accuracy) || 0, 0), 200);
    if (distance - slack > REPORT_RADIUS_M) {
      return { ok: false, error: `Kamu sekitar ${distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${distance} m`} dari kafe. Laporan hanya bisa dikirim dari dekat kafe.`, code: "far" };
    }
  }

  const { error } = await supabase.from("cafe_reports").insert({
    cafe_id: cafe.id, user_id: user.id, crowd, plugs, note,
    download_mbps: num(input.download, 2000), upload_mbps: num(input.upload, 2000),
    ping_ms: num(input.ping, 10000) != null ? Math.round(input.ping!) : null,
    distance_m: distance,
  });
  if (error) {
    if (error.code === "P0001") return { ok: false, error: error.message, code: "limit" };
    if (/cafe_reports/.test(error.message) && /exist|find|schema/.test(error.message)) return { ok: false, error: "Fitur laporan belum aktif. Admin perlu menjalankan migrasi 0018.", code: "setup" };
    console.error("[submitReport]", error);
    return { ok: false, error: "Laporan gagal dikirim. Coba lagi sebentar lagi." };
  }
  // Kabari yang menyimpan kafe ini (paling sering sekali tiap 3 jam per kafe)
  const summary = [`Dilaporkan ${CROWD[crowd as 1 | 2 | 3].label.toLowerCase()}`,
    num(input.download, 2000) != null ? `wifi ${Math.round(input.download!)} Mbps` : null,
    plugs ? `colokan ${PLUGS[plugs as 1 | 2 | 3].toLowerCase()}` : null].filter(Boolean).join(" · ");
  after(() => notifyCafeActivity(cafe.id, user.id, summary));
  revalidatePath(`/kafe/${input.slug}`);
  revalidatePath("/kafe");
  return { ok: true };
}

export async function deleteReport(f: FormData) {
  const supabase = await createClient();
  await supabase.from("cafe_reports").delete().eq("id", String(f.get("id") ?? "")); // RLS: milik sendiri atau admin
  revalidatePath(`/kafe/${String(f.get("slug") ?? "")}`);
  revalidatePath("/kafe");
}
