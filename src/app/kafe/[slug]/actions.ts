"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function toggleFavorite(cafeId: string, slug: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "login" };
  const { data } = await supabase.from("favorites").select("cafe_id").eq("user_id", user.id).eq("cafe_id", cafeId).maybeSingle();
  if (data) await supabase.from("favorites").delete().eq("user_id", user.id).eq("cafe_id", cafeId);
  else await supabase.from("favorites").insert({ user_id: user.id, cafe_id: cafeId });
  revalidatePath(`/kafe/${slug}`);
  return { ok: true };
}

export async function toggleVisited(cafeId: string, slug: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "login" };
  const { data } = await supabase.from("user_visits").select("cafe_id").eq("user_id", user.id).eq("cafe_id", cafeId).maybeSingle();
  if (data) await supabase.from("user_visits").delete().eq("user_id", user.id).eq("cafe_id", cafeId);
  else await supabase.from("user_visits").insert({ user_id: user.id, cafe_id: cafeId });
  revalidatePath(`/kafe/${slug}`);
  return { ok: true };
}

export async function unlockCafe(cafeId: string, slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("unlock_cafe", { p_cafe_id: cafeId });
  if (error) return { error: error.message };
  revalidatePath(`/kafe/${slug}`);
  return { result: data as string };
}
