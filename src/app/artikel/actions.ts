"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; on: boolean } | { ok: false; login?: boolean; error?: string };

/** Suka / batal suka, atau simpan / batal simpan. Hanya untuk pengguna yang login (RLS memastikan baris miliknya sendiri). */
async function toggle(table: "article_likes" | "article_saves", articleId: string, on: boolean, slug: string): Promise<Result> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub as string | undefined;
  if (!uid) return { ok: false, login: true };
  const { error } = on
    ? await supabase.from(table).upsert({ article_id: articleId, user_id: uid }, { onConflict: "article_id,user_id", ignoreDuplicates: true })
    : await supabase.from(table).delete().eq("article_id", articleId).eq("user_id", uid);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/artikel/${slug}`);
  if (table === "article_saves") revalidatePath("/akun");
  return { ok: true, on };
}

export async function setArticleLike(articleId: string, on: boolean, slug: string) {
  return toggle("article_likes", articleId, on, slug);
}

export async function setArticleSave(articleId: string, on: boolean, slug: string) {
  return toggle("article_saves", articleId, on, slug);
}
