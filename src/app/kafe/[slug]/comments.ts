"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CommentState = { ok?: number; error?: string } | null;

export async function addComment(_prev: CommentState, f: FormData): Promise<CommentState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Masuk dulu untuk berkomentar." };

  const cafeId = String(f.get("cafe_id") ?? "");
  const slug = String(f.get("slug") ?? "");
  const parentId = String(f.get("parent_id") ?? "") || null;
  const body = String(f.get("body") ?? "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  if (body.length < 2) return { error: "Komentarnya masih kosong." };
  if (body.length > 1000) return { error: "Komentar maksimal 1.000 huruf." };
  if ((body.match(/https?:\/\//g) ?? []).length > 2) return { error: "Terlalu banyak link dalam satu komentar." };

  // Batas: 10 komentar per jam per orang
  const since = new Date(Date.now() - 36e5).toISOString();
  const { count } = await supabase.from("cafe_comments").select("id", { count: "exact", head: true }).eq("user_id", user.id).gt("created_at", since);
  if ((count ?? 0) >= 10) return { error: "Kamu sudah berkomentar 10 kali dalam sejam terakhir. Coba lagi nanti ya." };

  // Balasan selalu menempel ke komentar utama (1 tingkat)
  let parent: string | null = null;
  if (parentId) {
    const { data: p } = await supabase.from("cafe_comments").select("id,parent_id,cafe_id").eq("id", parentId).maybeSingle();
    if (!p || p.cafe_id !== cafeId) return { error: "Komentar yang dibalas sudah tidak ada." };
    parent = p.parent_id ?? p.id;
  }

  const { error } = await supabase.from("cafe_comments").insert({ cafe_id: cafeId, user_id: user.id, parent_id: parent, body });
  if (error) {
    if (/cafe_comments/.test(error.message) && /exist|find|schema/.test(error.message)) return { error: "Fitur komentar belum aktif. Admin perlu menjalankan migrasi 0011." };
    if (/row-level|policy/.test(error.message)) return { error: "Komentar belum bisa dikirim untuk kafe ini." };
    return { error: error.message };
  }
  revalidatePath(`/kafe/${slug}`);
  return { ok: Date.now() };
}

export async function deleteComment(f: FormData) {
  const supabase = await createClient();
  const id = String(f.get("id") ?? "");
  const slug = String(f.get("slug") ?? "");
  await supabase.from("cafe_comments").delete().eq("id", id); // RLS: hanya milik sendiri atau admin
  revalidatePath(`/kafe/${slug}`);
}
