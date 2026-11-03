import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isBot } from "@/lib/stats";

// Menambah jumlah dilihat artikel (dipanggil sekali saat artikel dibuka). Selalu 204.
export async function POST(req: NextRequest) {
  const done = new NextResponse(null, { status: 204 });
  try {
    const ua = req.headers.get("user-agent") ?? "";
    if (isBot(ua)) return done;
    const body = (await req.json().catch(() => null)) as { article_id?: string } | null;
    const id = String(body?.article_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return done;
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    const viewer = createHash("sha256").update(`${ip}|${ua}|${day}|${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`).digest("hex").slice(0, 40);
    const { data: claims } = await (await createClient()).auth.getClaims();
    const { error } = await createAdminClient().rpc("log_article_view", {
      p_article_id: id, p_viewer: viewer, p_user_id: (claims?.claims?.sub as string | undefined) ?? null,
    });
    if (error && !/does not exist|schema cache/.test(error.message)) console.error("[lihat-artikel]", error.message);
  } catch (e) {
    console.error("[lihat-artikel]", e);
  }
  return done;
}
