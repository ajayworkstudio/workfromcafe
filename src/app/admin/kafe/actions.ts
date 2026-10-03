"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DAYS, slugify } from "@/lib/utils";
import type { OpeningHours } from "@/lib/types";

export async function saveCafe(formData: FormData) {
  const supabase = await createClient();
  const id = (formData.get("id") as string) || null;
  const name = String(formData.get("name"));
  const num = (k: string) => (formData.get(k) ? Number(formData.get(k)) : null);

  const hours: OpeningHours = {};
  for (const { key } of DAYS) {
    const closed = formData.get(`closed_${key}`) === "on";
    const o = String(formData.get(`open_${key}`) || "");
    const c = String(formData.get(`close_${key}`) || "");
    hours[key] = closed || !o || !c ? null : [o, c];
  }

  const cafe = {
    name,
    slug: String(formData.get("slug") || "") || slugify(name),
    city_id: String(formData.get("city_id")),
    area: (formData.get("area") as string) || null,
    address: (formData.get("address") as string) || null,
    lat: num("lat"),
    lng: num("lng"),
    price_range: Number(formData.get("price_range") || 2),
    my_rating: num("my_rating"),
    short_review: (formData.get("short_review") as string) || null,
    is_featured: formData.get("is_featured") === "on",
    is_published: formData.get("is_published") === "on",
    visited_at: (formData.get("visited_at") as string) || null,
    opening_hours: hours,
  };

  let cafeId = id;
  if (id) {
    const { error } = await supabase.from("cafes").update(cafe).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase.from("cafes").insert(cafe).select("id").single();
    if (error) throw new Error(error.message);
    cafeId = data.id;
  }

  await supabase.from("cafe_details").upsert({
    cafe_id: cafeId,
    full_review: (formData.get("full_review") as string) || null,
    tips: (formData.get("tips") as string) || null,
    best_time: (formData.get("best_time") as string) || null,
  });

  const tagIds = formData.getAll("tags").map(String);
  await supabase.from("cafe_tags").delete().eq("cafe_id", cafeId!);
  if (tagIds.length) await supabase.from("cafe_tags").insert(tagIds.map((tag_id) => ({ cafe_id: cafeId, tag_id })));

  // Kota otomatis aktif begitu punya kafe yang dipublikasikan
  if (cafe.is_published) await supabase.from("cities").update({ is_active: true }).eq("id", cafe.city_id);

  revalidatePath("/", "layout");
  redirect(`/admin/kafe/${cafeId}?tersimpan=1`);
}

export async function deleteCafe(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("cafes").delete().eq("id", String(formData.get("id")));
  revalidatePath("/", "layout");
  redirect("/admin/kafe");
}
