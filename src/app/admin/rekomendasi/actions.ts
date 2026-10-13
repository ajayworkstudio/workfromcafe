"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { createCafeFromSubmission } from "@/lib/submissionPublish";
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
  const res = await createCafeFromSubmission(supabase, sub, { publish: false, note: String(formData.get("note") || "").trim() || null });
  if ("error" in res) return back(res.error);
  const cafe = { id: res.cafeId };

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

/** Simpan setelan persetujuan otomatis. */
export async function saveAutoSettings(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const on = formData.get("auto_approve") === "on";
  const limit = Math.max(1, Math.min(20, Math.round(Number(formData.get("auto_daily_limit")) || 3)));
  const { error } = await supabase.from("app_settings").upsert([
    { key: "auto_approve", value: on ? "true" : "false" },
    { key: "auto_trust_new", value: formData.get("auto_trust_new") === "on" ? "true" : "false" },
    { key: "auto_daily_limit", value: String(limit) },
  ]);
  revalidateTag("settings");
  revalidatePath("/admin/rekomendasi");
  redirect(error
    ? `/admin/rekomendasi?err=${encodeURIComponent(error.message)}`
    : `/admin/rekomendasi?ok=${encodeURIComponent(on ? "Persetujuan otomatis aktif. Kiriman yang lolos semua cek wajib langsung tayang." : "Persetujuan otomatis dimatikan. Semua kiriman menunggu review.")}`);
}
