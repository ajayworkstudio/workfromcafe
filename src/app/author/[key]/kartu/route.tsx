import { createPublicClient } from "@/lib/supabase/server";
import { getAuthors, levelFor } from "@/lib/author";
import { renderKuratorCard, type CardFormat } from "@/lib/kuratorCard";

export const runtime = "nodejs";

/** GET /author/<username>/kartu?f=story|post → gambar PNG kartu Kurator. */
export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const key = decodeURIComponent((await params).key).toLowerCase();
  const author = (await getAuthors()).find((a) => a.username === key || a.id === key);
  // Kartu hanya untuk level Kurator ke atas (5+ kafe tayang)
  if (!author || !levelFor(author.cafe_count).current || author.cafe_count < 5) {
    return new Response("Kartu Kurator belum tersedia", { status: 404 });
  }
  const f = new URL(req.url).searchParams.get("f");
  const format: CardFormat = f === "post" ? "post" : "story";

  const { data } = await createPublicClient()
    .from("cafes").select("city:cities(name)").eq("contributor_id", author.id).eq("is_published", true);
  const cities = [...new Set(((data ?? []) as unknown as { city: { name: string } | null }[]).map((c) => c.city?.name).filter(Boolean) as string[])];

  return renderKuratorCard(author, cities, format);
}
