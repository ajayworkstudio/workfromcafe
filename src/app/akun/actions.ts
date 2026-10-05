"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { USERNAME_RE } from "@/lib/author";

export type ProfileState = { ok?: string; error?: string } | null;

export async function updateProfile(_prev: ProfileState, f: FormData): Promise<ProfileState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesi habis. Silakan masuk lagi." };

  const name = String(f.get("name") ?? "").trim().slice(0, 60);
  const bio = String(f.get("bio") ?? "").trim().slice(0, 300) || null;
  const instagram = String(f.get("instagram") ?? "").trim()
    .replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/[/?#].*$/, "").slice(0, 40) || null;
  const avatar = String(f.get("avatar_url") ?? "").trim();
  if (!name) return { error: "Nama tidak boleh kosong." };
  const hasUsername = f.has("username");
  const username = String(f.get("username") ?? "").trim().toLowerCase().replace(/^@/, "") || null;
  if (username && !USERNAME_RE.test(username)) return { error: "Username 3–30 karakter: huruf kecil, angka, titik, strip, atau garis bawah." };
  if (instagram && !/^[a-zA-Z0-9._]+$/.test(instagram)) return { error: "Username Instagram hanya boleh huruf, angka, titik, dan garis bawah." };

  // Foto hanya boleh dari folder milik sendiri, atau foto lama (mis. dari Google) yang tidak diubah
  const { data: current } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle();
  const ownPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/cafe-photos/avatars/${user.id}/`;
  const avatar_url = !avatar ? null : avatar === current?.avatar_url || avatar.startsWith(ownPrefix) ? avatar : current?.avatar_url ?? null;

  const patch: Record<string, unknown> = { name, bio, instagram, avatar_url };
  if (hasUsername) patch.username = username;
  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) {
    if (/profiles_username_key|duplicate/.test(error.message)) return { error: "Username itu sudah dipakai orang lain. Coba yang lain." };
    if (/username/.test(error.message)) return { error: "Database belum diperbarui. Admin perlu menjalankan migrasi 0012." };
    if (/bio|instagram/.test(error.message)) return { error: "Database belum diperbarui. Admin perlu menjalankan migrasi 0009_profil_author.sql." };
    return { error: error.message };
  }

  // Hapus foto lama di storage kalau diganti
  const old = current?.avatar_url;
  if (old && old !== avatar_url && old.startsWith(ownPrefix)) {
    await supabase.storage.from("cafe-photos").remove([old.slice(old.indexOf("/cafe-photos/") + "/cafe-photos/".length)]);
  }

  revalidatePath("/", "layout");
  return { ok: "Profil disimpan." };
}
