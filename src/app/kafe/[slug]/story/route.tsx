import { createPublicClient } from "@/lib/supabase/server";
import { renderCafeStory } from "@/lib/storyCard";
import { CAFE_LIST_SELECT } from "@/lib/utils";
import type { Cafe } from "@/lib/types";
import type { CafeReport } from "@/lib/reports";

export const runtime = "nodejs";

/** GET /kafe/<slug>/story → gambar PNG 1080×1920 untuk Instagram/WhatsApp Story. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = createPublicClient();
  const { data } = await db.from("cafes").select(CAFE_LIST_SELECT).eq("slug", slug).eq("is_published", true).maybeSingle();
  const cafe = data as Cafe | null;
  if (!cafe) return new Response("Kafe tidak ditemukan", { status: 404 });
  const { data: reports } = await db.rpc("cafe_reports_recent", { p_cafe_id: cafe.id });
  return renderCafeStory(cafe, (reports as CafeReport[] | null) ?? []);
}
